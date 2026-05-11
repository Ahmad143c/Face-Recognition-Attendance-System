import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../contexts/ToastContext';
import * as faceapi from 'face-api.js';
import { v4 as uuidv4 } from 'uuid';

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    jobTitle: '',
    department: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const departments = ['Engineering', 'Marketing', 'HR', 'Finance', 'Operations', 'Design'];

  const startVideo = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video metadata to load before setting as ready
        videoRef.current.onloadedmetadata = () => {
          setIsVideoReady(true);
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      addToast('Failed to access camera. Please check permissions.', 'error');
    }
  }, [addToast]);

  const loadFaceApiModels = React.useCallback(async () => {
    try {
      addToast('Loading face recognition models...', 'info', 0);
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'),
        faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'),
        faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model')
      ]);
      setModelsLoaded(true);
      addToast('Models loaded successfully', 'success', 2000);
      startVideo();
    } catch (error) {
      console.error('Error loading models:', error);
      addToast('Failed to load face recognition models', 'error');
    }
  }, [addToast, startVideo]);

  useEffect(() => {
    if (currentStep === 2) {
      loadFaceApiModels();
    }
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentStep, loadFaceApiModels]);

  const detectFace = React.useCallback(async () => {
    try {
      if (!modelsLoaded || !isVideoReady || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Additional safety checks
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;

      // Set explicit dimensions if not already set
      if (!video.width) video.width = 640;
      if (!video.height) video.height = 480;

      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      const displaySize = { width: video.width || 640, height: video.height || 480 };
      faceapi.matchDimensions(canvas, displaySize);

      if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          faceapi.draw.drawDetections(canvas, resizedDetections);
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        }
        
        setFaceDetected(true);
        return resizedDetections.descriptor;
      } else {
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
        setFaceDetected(false);
        return null;
      }
    } catch (error) {
      console.error('Error in detectFace:', error);
      setFaceDetected(false);
      return null;
    }
  }, [modelsLoaded, isVideoReady]);

  useEffect(() => {
    if (currentStep === 2 && modelsLoaded && isVideoReady) {
      const interval = setInterval(detectFace, 100);
      return () => clearInterval(interval);
    }
  }, [currentStep, modelsLoaded, isVideoReady, detectFace]);

  const captureFace = async () => {
    setIsCapturing(true);
    try {
      const descriptor = await detectFace();
      if (descriptor) {
        // Check if user with same name already exists
        const users = JSON.parse(localStorage.getItem('emp_users') || '[]');
        const existingUser = users.find(user => user.name.toLowerCase() === formData.fullName.toLowerCase());
        
        if (existingUser) {
          addToast('A user with this name already exists! Please use a different name or contact support.', 'error');
          setIsCapturing(false);
          return;
        }
        
        // Check if face already exists (face recognition)
        const faceExists = users.some(user => {
          if (!user.faceDescriptor) return false;
          const distance = faceapi.euclideanDistance(
            new Float32Array(user.faceDescriptor),
            new Float32Array(descriptor)
          );
          return distance < 0.6; // Threshold for face similarity
        });
        
        if (faceExists) {
          addToast('This face is already registered in our system! Please use a different face or contact support.', 'error');
          setIsCapturing(false);
          return;
        }
        
        setFaceDescriptor(Array.from(descriptor));
        addToast('Face captured successfully!', 'success');
      } else {
        addToast('No face detected. Please position your face in the frame.', 'error');
      }
    } catch (error) {
      console.error('Error capturing face:', error);
      addToast('Failed to capture face', 'error');
    } finally {
      setIsCapturing(false);
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
      if (!formData.jobTitle.trim()) newErrors.jobTitle = 'Job title is required';
      if (!formData.department) newErrors.department = 'Department is required';
    }

    if (step === 3) {
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
      if (!formData.password) newErrors.password = 'Password is required';
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
      if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm password';
      else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep === 2 && !faceDescriptor) {
        addToast('Please capture your face before proceeding', 'error');
        return;
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateStep(3)) {
      try {
        const users = JSON.parse(localStorage.getItem('emp_users') || '[]');
        
        // Final validation: Check if user with same name already exists
        const existingUser = users.find(user => user.name.toLowerCase() === formData.fullName.toLowerCase());
        if (existingUser) {
          addToast('A user with this name already exists! Please use a different name.', 'error');
          return;
        }
        
        // Final validation: Check if face already exists
        if (faceDescriptor) {
          const faceExists = users.some(user => {
            if (!user.faceDescriptor) return false;
            const distance = faceapi.euclideanDistance(
              new Float32Array(user.faceDescriptor),
              new Float32Array(faceDescriptor)
            );
            return distance < 0.6;
          });
          
          if (faceExists) {
            addToast('This face is already registered in our system! Please use a different face or contact support.', 'error');
            return;
          }
        }
        
        const newUser = {
          id: uuidv4(),
          name: formData.fullName,
          jobTitle: formData.jobTitle,
          department: formData.department,
          faceDescriptor: faceDescriptor,
          email: formData.email,
          password: formData.password, // In production, this should be hashed
          registeredAt: new Date().toISOString(),
          role: 'employee'
        };

        users.push(newUser);
        localStorage.setItem('emp_users', JSON.stringify(users));
        
        addToast('Registration successful! Please login to continue.', 'success');
        navigate('/login');
      } catch (error) {
        console.error('Error saving user:', error);
        addToast('Registration failed. Please try again.', 'error');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              
              <h2 className="text-3xl font-bold text-gradient mb-2">Personal Information</h2>
              <p className="text-gray-400">Tell us about yourself to get started</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div 
                className="space-y-2"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                  <svg className="w-4 h-4 mr-2 text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className={`input-field ${errors.fullName ? 'border-red-500' : ''} backdrop-blur-sm`}
                  placeholder="Enter your full name"
                />
                {errors.fullName && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-sm mt-1 flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.fullName}
                  </motion.p>
                )}
              </motion.div>

              <motion.div 
                className="space-y-2"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                  <svg className="w-4 h-4 mr-2 text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Job Title
                </label>
                <input
                  type="text"
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleInputChange}
                  className={`input-field ${errors.jobTitle ? 'border-red-500' : ''} backdrop-blur-sm`}
                  placeholder="Enter your job title"
                />
                {errors.jobTitle && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-sm mt-1 flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.jobTitle}
                  </motion.p>
                )}
              </motion.div>
            </div>

            <motion.div 
              className="space-y-2"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                <svg className="w-4 h-4 mr-2 text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Department
              </label>
              <select
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                className={`input-field ${errors.department ? 'border-red-500' : ''} backdrop-blur-sm`}
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              {errors.department && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-sm mt-1 flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.department}
                </motion.p>
              )}
            </motion.div>

            <motion.div 
              className="glass-card p-4 border border-cyan/50 bg-gradient-to-r from-cyan/10 to-amber/10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan to-amber rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-cyan">Step 1 of 3</h4>
                  <p className="text-sm text-gray-400">Your personal information helps us customize your experience</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              
              <h2 className="text-3xl font-bold text-gradient mb-2">Face Registration</h2>
              <p className="text-gray-400">Capture your face for secure login</p>
            </div>
            
            {!modelsLoaded && (
              <motion.div 
                className="text-center py-12"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="relative inline-block">
                  <div className="w-24 h-24 bg-gradient-to-br from-cyan/20 to-amber/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <div className="w-16 h-16 border-4 border-cyan border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <motion.div 
                    className="absolute inset-0 w-24 h-24 bg-cyan/20 rounded-full animate-ping mx-auto"
                    style={{ margin: '0 auto' }}
                  />
                </div>
                <p className="text-lg text-gray-300 mb-2">Loading face recognition models...</p>
                <p className="text-sm text-gray-500">This may take a few moments</p>
              </motion.div>
            )}

            {modelsLoaded && (
              <div className="space-y-6">
                <motion.div 
                  className="relative mx-auto w-fit"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      width="640"
                      height="480"
                      className="rounded-xl border-2 border-gray-700 shadow-2xl"
                    />
                    <canvas
                      ref={canvasRef}
                      width="640"
                      height="480"
                      className="absolute top-0 left-0 rounded-xl"
                    />
                    
                    {/* Face detection overlay */}
                    <div className="absolute top-4 right-4">
                      <motion.div 
                        className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2 ${
                          faceDetected 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                            : 'bg-red-500/20 text-red-400 border border-red-500/50'
                        }`}
                        animate={{ scale: faceDetected ? [1, 1.1, 1] : 1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                        <span>{faceDetected ? 'Face Detected' : 'No Face'}</span>
                      </motion.div>
                    </div>

                    {/* Camera frame decoration */}
                    <div className="absolute inset-0 border-2 border-cyan/30 rounded-xl pointer-events-none">
                      <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-cyan rounded-tl-lg"></div>
                      <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-cyan rounded-tr-lg"></div>
                      <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-cyan rounded-bl-lg"></div>
                      <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-cyan rounded-br-lg"></div>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  className="flex flex-col items-center space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <button
                    onClick={captureFace}
                    disabled={isCapturing || !faceDetected}
                    className={`group relative px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                      (!faceDetected || isCapturing)
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-cyan to-amber text-black hover:shadow-lg hover:shadow-cyan/25 transform hover:scale-105'
                    }`}
                  >
                    <span className="flex items-center space-x-3">
                      {isCapturing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                          <span>Capturing...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>Capture Face</span>
                        </>
                      )}
                    </span>
                  </button>

                  {faceDescriptor && (
                    <motion.div 
                      className="w-full glass-card p-6 border border-green-500/50 bg-gradient-to-r from-green-500/10 to-emerald-500/10"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <div className="flex items-center space-x-4">
                        <motion.div 
                          className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.5, repeat: 2 }}
                        >
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </motion.div>
                        <div className="flex-1">
                          <h4 className="font-bold text-green-400 text-lg">Face Captured Successfully!</h4>
                          <p className="text-gray-300">Your face has been registered for secure login</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {!faceDetected && (
                    <motion.div 
                      className="w-full glass-card p-4 border border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-amber-400">Position Your Face</h4>
                          <p className="text-sm text-gray-300">Make sure your face is well-lit and clearly visible in the frame</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>

                <motion.div 
                  className="glass-card p-4 border border-cyan/50 bg-gradient-to-r from-cyan/10 to-amber/10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan to-amber rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-cyan">Step 2 of 3</h4>
                      <p className="text-sm text-gray-400">Face registration enables secure biometric login</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gradient mb-2">Account Credentials</h2>
              <p className="text-gray-400">Create your login credentials</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <motion.div 
                className="space-y-2"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                  <svg className="w-4 h-4 mr-2 text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`input-field ${errors.email ? 'border-red-500' : ''} backdrop-blur-sm`}
                  placeholder="Enter your email address"
                />
                {errors.email && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-sm mt-1 flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.email}
                  </motion.p>
                )}
              </motion.div>

              <motion.div 
                className="space-y-2"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                  <svg className="w-4 h-4 mr-2 text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`input-field ${errors.password ? 'border-red-500' : ''} backdrop-blur-sm`}
                  placeholder="Create a strong password"
                />
                {errors.password && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-sm mt-1 flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.password}
                  </motion.p>
                )}
                {formData.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${formData.password.length >= 6 ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                      <span className="text-xs text-gray-400">At least 6 characters</span>
                    </div>
                  </div>
                )}
              </motion.div>

              <motion.div 
                className="space-y-2"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                  <svg className="w-4 h-4 mr-2 text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`input-field ${errors.confirmPassword ? 'border-red-500' : ''} backdrop-blur-sm`}
                  placeholder="Confirm your password"
                />
                {errors.confirmPassword && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-sm mt-1 flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.confirmPassword}
                  </motion.p>
                )}
                {formData.confirmPassword && (
                  <div className="mt-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${formData.password === formData.confirmPassword ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={`text-xs ${formData.password === formData.confirmPassword ? 'text-green-400' : 'text-red-400'}`}>
                        {formData.password === formData.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            </form>

            <motion.div 
              className="glass-card p-4 border border-cyan/50 bg-gradient-to-r from-cyan/10 to-amber/10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan to-amber rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-cyan">Step 3 of 3</h4>
                  <p className="text-sm text-gray-400">Almost done! Create your account credentials</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              className="glass-card p-4 border border-green-500/30 bg-gradient-to-r from-green-500/5 to-emerald-500/5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-green-400 mb-2">Ready to Complete Registration</h4>
                  <p className="text-sm text-gray-300 mb-3">You're all set! Click "Complete Registration" to create your account and start using FACEMARK.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-cyan/20 text-cyan text-xs rounded-full">✓ Personal Info</span>
                    <span className="px-2 py-1 bg-cyan/20 text-cyan text-xs rounded-full">✓ Face Registered</span>
                    <span className="px-2 py-1 bg-cyan/20 text-cyan text-xs rounded-full">✓ Account Setup</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-8 sm:py-12 px-4 mobile-full-height">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="glass-card p-6 sm:p-8">
          {/* Progress Steps with Progress Bar */}
          <div className="relative mb-8 sm:mb-12">
            {/* Progress bar background */}
            <div className="absolute top-7 left-3 right-0 h-1 bg-gray-700 rounded-full">
              {/* Filled progress for completed steps only */}
              {currentStep > 1 && (
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan to-amber rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              )}
            </div>
            
            <div className="relative flex items-center justify-between">
              {[1, 2, 3].map((step, index) => {
                const stepTitles = ['Personal', 'Face', 'Account'];
                const stepIcons = [
                  <svg key="icon1" className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>,
                  <svg key="icon2" className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>,
                  <svg key="icon3" className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ];
                
                const isActive = step === currentStep;
                const isCompleted = step < currentStep;
                
                return (
                  <div key={step} className="flex flex-col items-center">
                    <motion.div
                      className="relative"
                      whileHover={{ scale: 1.15 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      {/* Glow effect for active/completed steps */}
                      {(isActive || isCompleted) && (
                        <motion.div
                          className={`absolute inset-0 w-10 h-10 sm:w-14 sm:h-14 rounded-full blur-xl ${
                            isCompleted ? 'bg-green-500/40' : 'bg-cyan/40'
                          }`}
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 0.8, 0.5]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />
                      )}
                      
                      {/* Main step circle */}
                      <motion.div
                        className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-bold text-sm sm:text-lg border-2 relative z-10 ${
                          isCompleted
                            ? 'bg-gradient-to-br from-green-500 to-emerald-500 text-white border-green-400 shadow-lg shadow-green-500/25'
                            : isActive
                            ? 'bg-gradient-to-br from-cyan to-amber text-black border-cyan shadow-lg shadow-cyan/25'
                            : 'bg-gray-800 text-gray-400 border-gray-600'
                        }`}
                        initial={{ scale: 0 }}
                        animate={{
                          scale: isCompleted ? 1 : isActive ? 1.1 : 1,
                        }}
                        transition={{
                          scale: { type: "spring", stiffness: 300 },
                        }}
                      >
                        {isCompleted ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                          >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </motion.div>
                        ) : (
                          stepIcons[index]
                        )}
                      </motion.div>
                      
                      {/* Pulse effect for active step */}
                      {isActive && (
                        <motion.div
                          className="absolute top-0 h-full bg-gradient-to-r from-cyan/50 to-amber/50 rounded-full"
                          animate={{
                            scale: [1, 1.3, 1],
                            opacity: [1, 0, 1]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />
                      )}
                    </motion.div>
                    
                    {/* Step title and description */}
                    <motion.div
                      className="mt-4 text-center"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: isActive || isCompleted ? 1 : 0.6,
                        y: 0
                      }}
                      transition={{ delay: 0.2 }}
                    >
                      <h3 className={`font-bold text-xs sm:text-sm mb-1 ${
                        isCompleted
                          ? 'text-green-400'
                          : isActive
                          ? 'text-cyan'
                          : 'text-gray-500'
                      }`}>
                        {stepTitles[index]}
                      </h3>
                      <p className="text-xs text-gray-400 hidden sm:block">
                        {step === 1 && 'Personal Information'}
                        {step === 2 && 'Face Registration'}
                        {step === 3 && 'Account Credentials'}
                      </p>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="min-h-[400px]">
            <AnimatePresence mode="wait">
              {renderStepContent()}
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className={`btn-secondary ${currentStep === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Previous
            </button>

            {currentStep < 3 ? (
              <button onClick={handleNext} className="btn-primary">
                Next
              </button>
            ) : (
              <button onClick={handleSubmit} className="btn-primary">
                Complete Registration
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;