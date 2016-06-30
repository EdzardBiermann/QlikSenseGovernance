# Qlik Sense Governance
Project to help to better understand a Qlik Sense Site, focused in applications and their components' perspective(fields, charts, stories, governed components, etc.).

Tested with Qlik Sense 2.2.3.

Follow the Instructions.pdf file to find out more information about this project and how to try it yourself.

### Release History
 * v1 - Initial relase of the project
 * v1.1 - Added capability to pool the server apps impersonating it's users. This allows to get information about what the users can actually reach within the Sense Server environment, i.e: the user's personal apps in the "My Work" stream
 * v1.2 - Added a new mode: "No Data". This mode allows to use Sense's 'Open Apps Without Data' feature, avoiding heavy RAM consumption for quick apps metadata update (such as master items, users objects, sheets, stories and bookmarks, etc.). When activated, no app datamodel information will be loaded.
