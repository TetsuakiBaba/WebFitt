# WebFitts

_WebFitts_ is a web-based Fitts' law testing application inspired by Scott MacKenzie's [GoFitts](http://www.yorku.ca/mack/FittsLawSoftware/) application. This repository is forked from [WebFitts](https://github.com/adildsw/WebFitt) and mofified to include a repeatation of the task. 

Original WebFitts has flask python code for saving the results of the task in the server. This modified version of WebFitts excludes the server saving functionality.

## Getting Started
1. Access the [WebFitts](https://tetsuakibaba.github.io/WebFitt/)

## Result Data Format
After the completion of every task, _WebFitts_ saves 3 task result files on the client system (and the same files are also stored on the server if _WebFitts_ is configured that way). The file description are differentiated using individual file types:
* _click_ - files of this type contains detailed information of every click made during the task.
* _task_ - files of this type contains the aggregated information of each task.
* _overall_ - files of this type contains the aggregated information obtained from all the tasks.

All the data are stored in CSV format, and can be accessed using any text editor of choice. The data headers are included with each file. The header definition and calculations are derived from Scott MacKenzie's [GoFitts](http://www.yorku.ca/mack/FittsLawSoftware/) application, the documentation of which can be found [here](http://www.yorku.ca/mack/FittsLawSoftware/doc/index.html?GoFitts.html). 

## Contribution
All contributions are welcome! You can open an issue to discuss the changes, and use pull requests to suggest modifications.
