# VIDEO ANNOTATOR DESKTOP APPLICATION.

# Run in Development mode

## Step 1: Run the video-annotator web application 
1.	Open command line terminal in videoannotator project
2.	Switch directory using "cd video-player-react"
3.	"npm install" to install the node_modules locally for video-player-react project.
4.	"npm start" to start the web application

Runs the application in web url http://localhost:8080.

## Step 2: Run the video-annotator electron application 
1.	Open command line terminal in videoannotator project
2.	"npm install" to install the node_modules locally.
3.	"npm run electron-development" to start the electron js application in development mode.
Note : This will work only when the web application is running prior.

# Package the application as exe.

## Step 1: Generate build files of the react application. 
1.	Open command line terminal in videoannotator project
2.	Switch directory using "cd video-player-react"
3.	"npm install" to install the node_modules locally for video-player-react project.
4.	"npm run build" - This will create a dist folder with build html and JS files in it.

### Run the electron JS application in production mode. (Optional) 
1.	Open command line terminal in videoannotator project
2.	"npm install" to install the node_modules locally.
3.	"npm run electron-production" to start the electron js application in production mode using the build files generated in the previous step.

## Step 2: Package the application as exe. 
1.	Open command line terminal in videoannotator project
2.	"npm install" to install the node_modules locally.
3.	"npm run make"- This will create a out folder where the exe file will be located.
