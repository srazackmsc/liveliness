import vision from './tasks-vision.js';
//import vision from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';
const { FaceLandmarker, FilesetResolver,FaceLandmarkerOptions } = vision;

export default class FaceLandMarkSDK {
    WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
    AssetPath = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
 
    constructor(){
        this.faceLandmarker = null;
        this.imageModel = null;
    }

    async initialize(){
        const runningMode = 'VIDEO';
        try{
            const filesetResolver = await FilesetResolver.forVisionTasks(this.WASM);
            this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver,{
                baseOptions : {
                    modelAssetPath : this.AssetPath,
                    delegate : 'GPU',
                },
                outputFaceBlendshapes:true,
                runningMode: "VIDEO",
                numFaces : 1,
            });
            this.imageModel = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions : {
                    modelAssetPath : this.AssetPath,
                    delegate : 'GPU',
                },
                outputFaceBlendshapes:true,
                runningMode : 'IMAGE',
                numFaces : 1,
            }); 
        }catch(err){
            console.error("Failed to initialize Facelandmarker",err);
        }
    }
    isInitialized(){
        return this.faceLandmarker;
    }
    async processVideoFrame(videoFrame){
        if(!this.faceLandmarker){
            throw new Error('SDK not initialized. Call initialize() first');
        }
        return this.faceLandmarker.detectForVideo(videoFrame,performance.now());
    }

    async processImageFrame(imageFrame){
        if(!this.faceLandmarker){
            throw new Error('SDK not initialized. Call initialize() first');
        }
        return this.faceLandmarker.detect(imageFrame);
    }

    close(){
        if(this.faceLandmarker){
            this.faceLandmarker.close();
            this.faceLandmarker = null;
        }
    }
}

window.FaceLandMarkSDK = FaceLandMarkSDK;