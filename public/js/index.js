import FaceLandMarkSDK from './faceLandmarkSDK.js';
//import vision from './tasks-vision.js';
//import { FaceLandmarker } from vision;
//console.log(new FaceLandMarkSDK());
//debugger;
window.abdul = [];
const liveliness_images = document.getElementById('liveliness_images');
const videoRef = document.getElementById('videoRef');
const MESSAGEREF = document.getElementById('message');
let GLOBALSTATUS = "";
let MESSAGE_OBJ = {'msg':'','type':''}
let isRecording = false;
let blinkCountRef = 0;
let lastVideoTime = -1;
let webCamRunning = false;
let imageCaptured = false;
let imageCaptureStatus = false
let showRetry = false;
let progress = -1;
let eyeStatus= 'open';
let recordedVideo = null;
let capturedImage = null;
let imageLandmarker = null;
var faceLandmarkerObj = new FaceLandMarkSDK();
var mediaStream = MediaStream;
let mediaRecorder= MediaRecorder;
let STORE_VIDEO_DATA = [];
let STORE_IMAGE_DATA = [];
//const [imageLandmarker, setImageLandmarker] = useState<FaceLandmarker | null>(null);


function setImageCaptureStatus(flag){imageCaptureStatus = flag;}
function setCapturedImage(imgPath){capturedImage=imgPath;}
function setRecordedVideo(str){ recordedVideo = str;}
function setShowRetry(flag){ showRetry = flag;}
function getShowRetry(){ return showRetry;}
function setProgress(val){   progress = val;}
function getProgress(){    return progress;}
function showLoader(){    MESSAGEREF.style.display = "block"; }
function hideLoader(){    /*MESSAGEREF.style.display = "none"; */}
function setStatus(msg){    GLOBALSTATUS = msg; }
function getStatus(){    return GLOBALSTATUS; }
function setMessage(obj){    MESSAGE_OBJ = {...MESSAGE_OBJ,obj}; }
function getMessage(){    return MESSAGE_OBJ; }

  const enableCam = async () => {
    try{
        if(!faceLandmarkerObj.faceLandmarker) {
            console.info('facelandmarker not loaded yet!');
            await faceLandmarkerObj.initialize();
        }
        webCamRunning = !webCamRunning; 
        showLoader();
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        hideLoader();
        mediaStream = stream;
        if (videoRef) {
            setStatus("STARTED_PREDECTION");
            setMessage({ msg: "Please blink to detect", type: "Success" });
            videoRef.srcObject = stream;
            videoRef.setAttribute("playsinline", "true"); // ✅ Ensure inline playback
            videoRef.setAttribute("muted", "true"); // ✅ Prevent autoplay issues
    
            videoRef.addEventListener("canplay", () => {
                videoRef.play(); // ✅ Ensure video starts playing after it's loaded
            });
            //setTimeout(function(){
            videoRef.addEventListener("loadeddata", predictWebCam);
        //},100);
        }
    }catch (error) {
        console.error("Error accessing camera:", error);
        //setMessage({ msg: "Please allow camera permission", type: "Error" });
        hideLoader();
    }
  }
  const predictWebCam = async () => {
    if(isRecording) return;
    if(blinkCountRef >= 3 && !isRecording) {
      setTimeout(() => startRecording(), 500)
      return;
    };
    let startTimeMs = performance.now();
    let results;
    if (lastVideoTime !== videoRef.currentTime) {
      lastVideoTime = videoRef.currentTime;
      results = faceLandmarkerObj.faceLandmarker?.detectForVideo(videoRef, startTimeMs);
    }
    if(results) {
      countEyeBlink(results.faceBlendshapes)
    }
    if (webCamRunning === true) {
        //console.log(STORE_IMAGE_DATA);
        //console.log(blinkCountRef)
      window.requestAnimationFrame(predictWebCam);
    }
  }
  const countEyeBlink = (dataPoints) => {
    if (!dataPoints?.length) return;
    const leftEyeBlink = dataPoints[0].categories[9]?.score;
    const rightEyeBlink = dataPoints[0].categories[10]?.score;
    //console.log(leftEyeBlink +" , "+rightEyeBlink);
    if (leftEyeBlink < 0.3 && rightEyeBlink < 0.3 && eyeStatus === 'close') {
      blinkCountRef += 1;
      captureImage(leftEyeBlink, rightEyeBlink);
      captureImage(leftEyeBlink, rightEyeBlink);
      MESSAGEREF.innerHTML = "Eye Blink Count "+blinkCountRef;
      enableCam
      setProgress(blinkCountRef * 50)
      eyeStatus = 'open'
    }
    if (leftEyeBlink > 0.5) {eyeStatus = 'close'};
  }

  const startRecording = () => {
    isRecording = true;
    webCamRunning = false;
    if (!videoRef || !videoRef.srcObject) {
        setMessage({ msg: 'No video stream available for recording', type: 'Error' });
        return;
    }
    try {
        const stream = videoRef.srcObject;
        mediaRecorder = new MediaRecorder(stream);
        const recordedChunks= []; //const recordedChunks: Blob[] = [];
        mediaRecorder.ondataavailable = (event) => {
            if(event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        }
        mediaRecorder.onstop = async () => {
            isRecording = false;
            if(!imageCaptured) {
                setMessage({ msg: "Image capturing failed", type: "Error" })
                setShowRetry(true);
            } else {
                const blob = new Blob(recordedChunks, { type: 'vide/webm' });
                const videoURL = URL.createObjectURL(blob);
        
                if(videoRef) {
                    videoRef.srcObject = null;
                    videoRef.muted = true;
                    videoRef.src = videoURL;
                    videoRef.controls = false;
                    videoRef.play();
                    setMessage({ msg: '', type: 'Success' }); // playing recorded video
                    setStatus('RECORDING_COMPLETE')
                    setShowRetry(true);
                    setProgress(0)
                }
                const base64String = await blobToBase64(blob)
                setRecordedVideo(base64String.split(',')[1]);
            }
            //console.log(STORE_IMAGE_DATA);
            //console.log(STORE_VIDEO_DATA);
            window.abdul = STORE_IMAGE_DATA;
            stopCamera();
        }

        mediaRecorder.start();
        setMessage({ msg: 'Recording Video, Keep Blinking', type: 'Success' });
        setStatus('STARTED_RECORDING')
        startTimer();

    } catch (error) {
        console.log(error);
        setMessage({ msg: 'Failed to start recording', type: 'Error' });
    }
  };
const stopCamera = ()=> {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop()); // Stop the camera
    }
}
const startTimer = () => {
    let second = 0;
    setProgress(0);
    let interval = setInterval(() => {
      second = second + 1;
      if(second === 2) {
        predictToCaptureImage()
      }
      let progressPercentage = (second * 100) / 15;
      setProgress(progressPercentage)
      if (second == 15) {
        clearInterval(interval);
        mediaRecorder.stop();
      }
    }, 1000);
}
const predictToCaptureImage = async () => {
    if(!isRecording || imageCaptured) {
      return;
    }
    const video = videoRef;
    const startTimeMs = performance.now();
    let results;
    if (lastVideoTime !== video.currentTime) {
      lastVideoTime = video.currentTime;
      results = faceLandmarkerObj.faceLandmarker.detectForVideo(
        video,
        startTimeMs
      );
    }

    const blendShapes = (results)?results.faceBlendshapes:[];

    if (blendShapes.length) {
      const leftEyeBlink = blendShapes[0].categories[9]?.score;
      const rightEyeBlink = blendShapes[0].categories[10]?.score;
  
      if (leftEyeBlink < 0.3 && rightEyeBlink < 0.3) {
        await captureImage(leftEyeBlink, rightEyeBlink);
      }
    }

    window.requestAnimationFrame(() => predictToCaptureImage());
  }
  const blobToBase64 = async (blob) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    return new Promise(resolve => {
      reader.onloadend = () => {
        resolve(reader.result);
      };
    });
  };
  const captureImage = async (leftEyeBlink, rightEyeBlink) => {
    // if(leftEyeBlink > 0.3 && rightEyeBlink > 0.3) {
    //   return;
    // }
    const canvas = document.createElement('canvas');
    const video = videoRef;
    if (canvas && video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert the canvas to an image element for MediaPipe
      const img = new Image();
      img.src = canvas.toDataURL('image/png');
      await img.decode(); 

      verifyEyeOpen(img);
      //storeVerifiedImage(img);
    }
  };
  const verifyEyeOpen = async(imageElement) => {
    if(!imageLandmarker) return;  
    const results = imageLandmarker.detect(imageElement);  
    if (results.faceBlendshapes.length) {
      const leftEyeOpen = results.faceBlendshapes[0].categories[9]?.score;
      const rightEyeOpen = results.faceBlendshapes[0].categories[10]?.score;
      
      if (leftEyeOpen < 0.3 && rightEyeOpen < 0.3) {
        storeVerifiedImage(imageElement)
      }
    }
  }
  const storeVerifiedImage = (imageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

    // Convert to Base64
    let capturedImageUrl = canvas.toDataURL('image/png');
    liveliness_images.appendChild(imageElement);
    // setImageURL(capturedImageUrl)
    STORE_IMAGE_DATA.push(String(capturedImageUrl.split(',')[1]));
    setCapturedImage(String(capturedImageUrl.split(',')[1]));
    imageCaptured = true;
    setImageCaptureStatus(true);
  }
  document.addEventListener('DOMContentLoaded',async function(e){
    await faceLandmarkerObj.initialize();
    imageLandmarker = faceLandmarkerObj.imageModel;
    const button = document.getElementById('startCamera');
    button.addEventListener('click', () => {
        enableCam('Hello from the module!'); // Call the greet function when the button is clicked
    });
    const stopCameraB = document.getElementById('stopCamera');
    stopCameraB.addEventListener('click', () => {
        //enableCam('Hello from the module!'); // Call the greet function when the button is clicked
        stopCamera();
    });
   // enableCam();
    console.log('start');
});

