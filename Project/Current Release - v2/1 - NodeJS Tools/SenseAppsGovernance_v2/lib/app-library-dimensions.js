var qsocks = require('qsocks');
var fs = require('fs');
var request = require('request');
var js2xmlparser = require('js2xmlparser');
var Promise = require("promise");
var exprFields = require('./expr-fields.js');

module.exports={
  getLibDimensions: function(conn_data, global, cookies, single_app){
    //Creating the promise for the Applications Library Dimensions
    //Root admin privileges should allow him to access to all available applications. Otherwise check your environment's security rules for the designed user.
    var promise_lib_dim = new Promise(function(resolve){

      console.log();
      console.log("*****************************************************");
      console.log("         Loading the Library Dimensions List         ");
      console.log("*****************************************************");
      
      //Loading a list of all the available documents
      global.getDocList().then(function(documents) {
        var available_docs = [];
        documents.forEach(function(document_entry){
          available_docs.push(document_entry.qDocId);
        });

        console.log("Processing each document");
        if(single_app){
          console.log("verifying user can access");
          var access_app = false;
          available_docs.forEach(function(application){
            if(application == conn_data.single_app_id)
              access_app = true;
          });
          if(access_app)
            getAppLibraryDimensions([conn_data.single_app_id]);
          else
            resolve("Checkpoint: User has no access to this applications") 
        }else{
          if(available_docs.length>0)
            getAppLibraryDimensions(available_docs);  
          else
            resolve("Checkpoint: The user has no available documents")
        }
      })

      //Loading library dimensions from all the documents, one at the time
      function getAppLibraryDimensions(document_list){
        console.log();
        console.log("──────────────────────────────────────");
        var first_app = document_list.shift();
        console.log(" "+first_app);
        console.log("──────────────────────────────────────");

        //Configurations to open the first document (based on mindspank's https://github.com/mindspank/qsocks examples)
        var o = 'http://'+conn_data.origin;

          var config_app = {
            host: conn_data.server_address,
            isSecure: true,
            origin: o,
            rejectUnauthorized: false,
            appname: first_app,
            headers: {
              "Content-Type": "application/json",
              "Cookie": cookies[0]
            }
          }

        //Scoped connection for the document
        qsocks.Connect(config_app).then(function(global) {
          global.openDoc(config_app.appname,"","","",conn_data.no_data).then(function(app) {
            //Checking for the document's contents and focusing on the dimensions
            app.getAllInfos().then(function(appInfos){
              var dimensions_list = [];
              appInfos.qInfos.forEach(function(document_infos){
                if(document_infos.qType=='dimension'){
                  dimensions_list.push(document_infos.qId)
                }
              })

              console.log(" Loading dimensions details:");

              //Verifying if the document has library dimensions
              if(dimensions_list.length>0)
                getDimensionDetails(dimensions_list);
              else if(dimensions_list.length==0 && document_list.length>0){
                console.log();
                console.log(" Loaded all dimensions. Jumping to next application.");
                console.log(" Remaining applications: " + document_list.length);
                getAppLibraryDimensions(document_list);
              }
              else if(dimensions_list.length==0 && document_list.length==0){ //checking if all dimensions and documents were processed
                console.log("──────────────────────────────────────");
                resolve("Checkpoint: Applications Library Dimensions are loaded");
              }
              else{
                console.log("──────────────────────────────────────");
                console.log ("Shouldn't be here, something went wrong...");
                process.exit();
              }

              //Loading the library dimensions of the document, one library dimension at the time
              function getDimensionDetails(dimensions_list){
                var first_dimension = dimensions_list.shift();
                console.log();
                console.log(" Dimension id: "+first_dimension);

                var start_time = Date.now();

                app.getDimension(first_dimension).then(function(dim){
                  //Loading the dimension's layout properties
                  dim.getLayout().then(function(dim_layout){

                    var dim_data = {
                      qInfo: dim_layout.qInfo,
                      qMeta: dim_layout.qMeta,
                      qDim: dim_layout.qDim
                    }

                    return dim_data;
                  })
                  .then(function(dim_layout){
                    //Loading the dimension's linked objects
                    dim.getLinkedObjects().then(function(dim_lnk){
                      var received_time = Date.now();
                      console.log("It took "+ (received_time-start_time) +"ms to receive the library dimension info.");

                      //setting up loading time
                      var loading_time = 0;
                      if(conn_data.timer_mode)
                        loading_time=received_time-start_time;

                      parse_dimensions = {calculated_dimensions: [], non_calculated_dimensions: [] };

                      dim_layout.qDim.qFieldDefs.forEach(function(dimension_expression){
                        if(dimension_expression.charAt(0)=='='){
                          parse_dimensions.calculated_dimensions.push(dimension_expression);
                        }else{
                          parse_dimensions.non_calculated_dimensions.push(dimension_expression);
                        }
                      });

                      exprFields.checkForDimensionFields(parse_dimensions).then(function(dimensions_parsed){
                        var parsed = {
                          parsedFields: { field: dimensions_parsed.dimensionFields },
                          parsingErrors: dimensions_parsed.dimensionFieldsErrors.length,
                          parsingErrorsDetails: { parsedFieldErrors: dimensions_parsed.dimensionFieldsErrors }
                        }

                        dim_layout.parsedData = parsed;

                        var dim_props = {
                                dim_layout,
                                dim_lnk,
                                qsLoadingTime: loading_time
                              }
                        return dim_props;
                      })
                      .then(function(data){
                        //Setting up options for XML file storage
                        var options = {
                          useCDATA: true
                        };

                        //Storing XML with the dimension's data
                        var xml_library_dimensions = js2xmlparser.parse("libraryDimensions", data, options);
                        fs.writeFile('AppStructures/'+config_app.appname+'_LibraryDimensions_'+first_dimension+'_'+conn_data.user_directory + '_' + conn_data.user_name+'.xml', xml_library_dimensions, function(err) {
                          if (err) throw err;
                          console.log('   '+config_app.appname+'_LibraryDimensions_'+first_dimension+'_'+conn_data.user_directory + '_' + conn_data.user_name+'.xml file saved');
                          console.log();
                          console.log("   Updating the remaining dimensions list");
                          console.log("   This is the dimensions list length: "+dimensions_list.length);
                          //Checking if all library dimensions were processed
                          if(dimensions_list.length>0)
                            getDimensionDetails(dimensions_list);
                          else if (dimensions_list.length==0 && document_list.length>0){
                            console.log();
                            console.log(" Loaded all dimensions. Jumping to next application.");
                            console.log(" Remaining applications: " + document_list.length);
                            getAppLibraryDimensions(document_list);
                          }
                          else if (dimensions_list.length==0 && document_list==0){ //checking if all dimensions and documents were processed
                            console.log("──────────────────────────────────────");
                            resolve("Checkpoint: Applications Library Dimensions are loaded");
                          } 
                          else {
                            console.log("──────────────────────────────────────");
                            console.log ("Shouldn't be here, something went wrong...");
                            process.exit();
                          }
                        })
                      })
                    })
                  })
                })
              }//getDimensionDetails
            })
          })
        })
      }//getAppLibraryDimensions
    })//promise
    return promise_lib_dim;
  }//getLibraryDimensions
}//module exports
