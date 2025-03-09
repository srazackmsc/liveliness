
import styles from './BlinkDetection.module.scss';
import CamButton from '../../../../components/cam-button/CamButton';
import CameraIcom from '../../../../assets/icons/camera.png';
import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FaceLandmarkerOptions, FilesetResolver } from '@mediapipe/tasks-vision';
import BlinkImage from '../../../../assets/images/blink-2.gif';
import HorizontalProgressBar from '../../../../components/button/porgress-bar/HorizontalProgressBar';
import { blobToBase64 } from '../../../../utils/blobToBase64';
import Button from '../../../../components/button/Button';
import SubmitIcon from '../../../../assets/icons/submit.png';
import RetakeIcon from '../../../../assets/icons/retake.png';
import { apiService } from '../../../../apis/services';
import { useNavigate } from 'react-router-dom';
import { useLoader } from '../../../../context/LoaderContext';

const modelOptions: FaceLandmarkerOptions = {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
    delegate: 'GPU',
  },
  outputFaceBlendshapes: true,
  runningMode: "VIDEO",
  numFaces: 1,
}

const imageModelOptions: FaceLandmarkerOptions = {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
    delegate: 'GPU',
  },
  outputFaceBlendshapes: true,
  runningMode: "IMAGE",
  numFaces: 1,
}

export const BlinkDetection = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState(-1);
  const { showLoader, hideLoader } = useLoader();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [message, setMessage] = useState<{msg: string, type: 'Success' | 'Error' | 'Info'}>();
  const [status, setStatus] = useState<'NOT_STARTED' | 'STARTED_PREDECTION' | 'STARTED_RECORDING' | 'RECORDING_COMPLETE'>('NOT_STARTED');
  const [imageCaptureStatus, setImageCaptureStatus]  = useState<boolean>(false);
  const [showRetry, setShowRetry] = useState<boolean>(false);
  // const [imageUrl, setImageURL] = useState('')

  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [imageLandmarker, setImageLandmarker] = useState<FaceLandmarker | null>(null);

  const videoRef = useRef<any>(null);
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const blinkCountRef = useRef(0);

  let webCamRunning = false;
  let eyeStatus: 'close' | 'open' = 'open';
  let imageCaptured = false;

  let lastVideoTime = -1;
  let results: any = undefined;

  let isRecording = false;

  useEffect(() => {
    initializeLandmarker();
  }, [])

  const initializeLandmarker = async () => {
    showLoader();
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');
      const faceModel = await FaceLandmarker.createFromOptions(filesetResolver, modelOptions);

      const imageModel = await FaceLandmarker.createFromOptions(filesetResolver, imageModelOptions); 

      setFaceLandmarker(faceModel);
      setImageLandmarker(imageModel);

      hideLoader();
    } catch (err) {
      hideLoader();
      setMessage({ msg: "Model failed, Try again", type: 'Error'})
    }
  }
  
  let mediaStream: MediaStream;

  const enableCam = async () => {
    try {
      if(!faceLandmarker || !imageLandmarker) {
        console.info('facelandmarker not loaded yet!');
        await initializeLandmarker();
      }

      webCamRunning = !webCamRunning; 

      showLoader();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      hideLoader();

      mediaStream = stream;
      if (videoRef.current) {
        setStatus("STARTED_PREDECTION");
        setMessage({ msg: "Please blink to detect", type: "Success" });
  
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); // ✅ Ensure inline playback
        videoRef.current.setAttribute("muted", "true"); // ✅ Prevent autoplay issues
  
        videoRef.current.addEventListener("canplay", () => {
          videoRef.current.play(); // ✅ Ensure video starts playing after it's loaded
        });
  
        videoRef.current.addEventListener("loadeddata", predictWebCam);
      }
    } catch (error) {
        console.error("Error accessing camera:", error);
        setMessage({ msg: "Please allow camera permission", type: "Error" });
        hideLoader();
    }
  }
  
  const predictWebCam = async () => {
    if(isRecording) return;
    if(blinkCountRef.current >= 2 && !isRecording) {
      setTimeout(() => startRecording(), 500)
      return;
    };

    let startTimeMs = performance.now();
    if (lastVideoTime !== videoRef.current.currentTime) {
      lastVideoTime = videoRef.current.currentTime;
      results = faceLandmarker?.detectForVideo(videoRef.current, startTimeMs);
    }
    if(results) {
      countEyeBlink(results.faceBlendshapes)
    }
    if (webCamRunning === true) {
      window.requestAnimationFrame(predictWebCam);
    }
  }

  const countEyeBlink = (dataPoints: any) => {
    if (!dataPoints?.length) return;
    const leftEyeBlink = dataPoints[0].categories[9]?.score;
    const rightEyeBlink = dataPoints[0].categories[10]?.score;
    if (leftEyeBlink < 0.3 && rightEyeBlink < 0.3 && eyeStatus === 'close') {
      blinkCountRef.current += 1;
      setProgress(blinkCountRef.current * 50)
      eyeStatus = 'open'
    }
    if (leftEyeBlink > 0.5) eyeStatus = 'close';
  }

  
  let mediaRecorder: MediaRecorder;
  const startRecording = () => {
    isRecording = true;
    webCamRunning = false;
    if (!videoRef.current || !videoRef.current.srcObject) {
      // setMessage({ msg: 'No video stream available for recording', type: 'Error' });
      return;
    }

    try {
      const stream = videoRef.current.srcObject  as MediaStream;
      mediaRecorder = new MediaRecorder(stream);
      const recordedChunks: Blob[] = [];

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
  
          if(videoRef.current) {
            videoRef.current.srcObject = null;
            videoRef.current.muted = true;
            videoRef.current.src = videoURL;
            videoRef.current.controls = false;
            videoRef.current.play();
            setMessage({ msg: '', type: 'Success' }); // playing recorded video
            setStatus('RECORDING_COMPLETE')
            setShowRetry(true);
            setProgress(0)
          }
          const base64String = await blobToBase64(blob)
          setRecordedVideo(base64String.split(',')[1]);
        }
        stopCamera();
      }

      mediaRecorder.start();
      setMessage({ msg: 'Recording Video, Keep Blinking', type: 'Success' });
      setStatus('STARTED_RECORDING')
      startTimer();

    } catch (error) {
      setMessage({ msg: 'Failed to start recording', type: 'Error' });
    }
  }

  function stopCamera() {
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
    const video = videoRef.current;
    const startTimeMs = performance.now();

    if (lastVideoTime !== video!.currentTime) {
      lastVideoTime = video!.currentTime;
      results = faceLandmarker?.detectForVideo(
        video,
        startTimeMs
      );
    }

    const blendShapes = results.faceBlendshapes;

    if (blendShapes.length) {
      const leftEyeBlink = blendShapes[0].categories[9]?.score;
      const rightEyeBlink = blendShapes[0].categories[10]?.score;
  
      if (leftEyeBlink < 0.3 && rightEyeBlink < 0.3) {
        await captureImage(leftEyeBlink, rightEyeBlink);
      }
    }

      window.requestAnimationFrame(() => predictToCaptureImage());
  }


  const captureImage = async (leftEyeBlink: number, rightEyeBlink: number) => {
    if(leftEyeBlink > 0.3 && rightEyeBlink > 0.3) {
      return;
    }
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    if (canvas && video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert the canvas to an image element for MediaPipe
      const img = new Image();
      img.src = canvas.toDataURL('image/png');
      await img.decode(); 

      verifyEyeOpen(img);
    }
  };

  const verifyEyeOpen = async(imageElement: HTMLImageElement) => {
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

  const storeVerifiedImage = (imageElement: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

    // Convert to Base64
    let capturedImageUrl = canvas.toDataURL('image/png');
    // setImageURL(capturedImageUrl)
    setCapturedImage(String(capturedImageUrl.split(',')[1]));
    imageCaptured = true;
    setImageCaptureStatus(true);
  }

  const handleUploadVideo = async () => {
    try {
      showLoader();
      setLoading(true);
      const res = await apiService.liveSpoofCheckV2(recordedVideo!, capturedImage!)
      if(res.data.success.code === '200') {
        navigate('/aadhaar-verify')
      }
      setLoading(false);
      hideLoader();
    } catch (e) {
      setLoading(false);
      hideLoader();
    }
  }

  const handleRetake = async () => {
    // Stop webcam stream
  if (videoRef.current && videoRef.current.srcObject) {
    const stream = videoRef.current.srcObject as MediaStream;
    const tracks = stream.getTracks(); // Get all tracks
    tracks.forEach((track) => track.stop()); // Stop each track
    videoRef.current.srcObject = null; // Clear video source
  }

  // Reset video element
  if (videoRef.current) {
    videoRef.current.src = '';
    videoRef.current.pause();
    videoRef.current.load();
    videoRef.current.controls = false;
  }

  // Reset states
  setProgress(0); // Reset blink count
  setCapturedImage(null); // Clear captured image
  setMessage({ msg: 'Retake initiated. Please blink to detect.', type: 'Success' }); 
  setStatus('STARTED_PREDECTION'); // Reset status
  setShowRetry(false);
  // Reset references
  blinkCountRef.current = 0;
  imageCaptured = false;
  setImageCaptureStatus(false);
  webCamRunning = false;
  eyeStatus = 'open';

  // Reinitialize webcam and start detection
  await initializeLandmarker();
  await enableCam();
  }

  return (
    <div className={styles.blink_detection}>
        <div className={styles.blink_detection__video}>
          <video id="camera" ref={videoRef} autoPlay playsInline muted></video>

            {/* For overlay */}
            {status !== 'RECORDING_COMPLETE' && <div className={styles.overlay_wrapper}>
              <div className={styles.cam_overlay}>
                {status === 'NOT_STARTED' && 
                  <img src={BlinkImage} alt="" />
                }
              </div>
            </div>}

            {/* For Test Content */}
            {message && <div className={styles.info} style={{ display: 'flex', justifyContent: 'center', zIndex: "99", color: message?.type === 'Error' ? 'red' : (message?.type === 'Success' ? 'green' : '')}}>
                <div style={{ background: 'white', padding: "0px 6px", fontWeight: '500', borderRadius: "7px"}}>
                  {message?.msg}
                </div>
            </div>}  
        </div>
        { status != "NOT_STARTED" && <HorizontalProgressBar progress={(progress <= 0 ? 0 : progress)} height={10} backgroundColor="rgb(42, 41, 41)" />}
        <div className={styles.blink_detection__actions}>

            {!showRetry && status !== 'RECORDING_COMPLETE' &&  <CamButton
                icon={CameraIcom} 
                onClick={enableCam} 
                alt="Camera"
                disabled={status != 'NOT_STARTED'}
            />}

            {showRetry && (status === 'RECORDING_COMPLETE' || !imageCaptureStatus) && <>
              <Button onClick={() => handleRetake()} icon={RetakeIcon} title='Retake' type='outlined' style={{padding: "5px 20px"}} />
            </>}

            {
                imageCaptureStatus && status === 'RECORDING_COMPLETE' && <Button onClick={() => !loading && handleUploadVideo()} icon={SubmitIcon} title={loading ? "Loading..." : 'Submit'} type='primary' style={{padding: "5px 20px"}} disabled={loading} />
            }
        </div>
    </div>
  )
}
