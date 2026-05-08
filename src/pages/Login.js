import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import * as faceapi from 'face-api.js';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [showFaceRecognition, setShowFaceRecognition] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // Check for admin login first
      if (formData.email === 'admin@company.com' && formData.password === 'Admin@123') {
        const adminUser = {
          userId: 'admin',
          role: 'admin',
          name: 'Administrator',
          email: 'admin@company.com'
        };
        login(adminUser);
        addToast('Admin login successful!', 'success');
        navigate('/dashboard/admin');
        return;
      }
      
      // Check for employee login
      const employees = JSON.parse(localStorage.getItem('emp_users') || '[]');
      const user = employees.find(emp => 
        emp.email === formData.email && emp.password === formData.password
      );

      if (user) {
        const userData = {
          userId: user.id,
          role: user.role,
          name: user.name,
          email: user.email
        };
        login(userData);
        addToast('Login successful!', 'success');
        navigate('/dashboard/employee');
      } else {
        setErrors({ general: 'Invalid email or password' });
        addToast('Invalid credentials', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      addToast('Login failed. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Face Recognition Functions
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

  const loginWithFace = React.useCallback(async (employee) => {
    try {
      // Log in user
      const userData = {
        userId: employee.id,
        role: employee.role || 'employee',
        name: employee.name,
        email: employee.email
      };
      
      login(userData);
      addToast(`Welcome back, ${employee.name}! Redirecting to dashboard...`, 'success');
      
      // Delay redirect to show success message
      setTimeout(() => {
        if (employee.role === 'admin') {
          navigate('/admin-dashboard');
        } else {
          navigate('/dashboard');
        }
      }, 1500);
      
    } catch (error) {
      console.error('Error with face login:', error);
      addToast('Face login failed', 'error');
    }
  }, [login, addToast, navigate]);

  const startScanning = React.useCallback(() => {
    setIsScanning(true);
    setMatchedUser(null);
  }, []);

  const stopScanning = React.useCallback(() => {
    setIsScanning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

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

  const recognizeFace = React.useCallback(async () => {
    if (!modelsLoaded || !isVideoReady || !isScanning || !videoRef.current || !canvasRef.current) return;

    try {
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

        // Get registered users
        const employees = JSON.parse(localStorage.getItem('emp_users') || '[]');
        
        if (employees.length > 0) {
          const labeledDescriptors = employees.map(emp => 
            new faceapi.LabeledFaceDescriptors(emp.id, [new Float32Array(emp.faceDescriptor)])
          );
          
          const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
          const match = faceMatcher.findBestMatch(resizedDetections.descriptor);

          if (match.label !== 'unknown') {
            const employee = employees.find(emp => emp.id === match.label);
            if (employee) {
              setMatchedUser(employee);
              await loginWithFace(employee);
              stopScanning();
            }
          }
        }
      } else {
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    } catch (error) {
      console.error('Error recognizing face:', error);
    }
  }, [modelsLoaded, isVideoReady, isScanning, loginWithFace, stopScanning]);

  useEffect(() => {
    if (showFaceRecognition && !modelsLoaded) {
      loadFaceApiModels();
    }
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [showFaceRecognition, modelsLoaded, loadFaceApiModels]);

  useEffect(() => {
    if (isScanning && modelsLoaded && isVideoReady) {
      intervalRef.current = setInterval(recognizeFace, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isScanning, modelsLoaded, isVideoReady, recognizeFace]);

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan to-amber rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-black font-bold text-2xl">F</span>
            </div>
            <h1 className="text-3xl font-bold text-gradient mb-2">Welcome Back</h1>
            <p className="text-gray-400">Login to your FACEMARK account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-3 border border-red-500/50"
              >
                <p className="text-red-400 text-sm">{errors.general}</p>
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`input-field ${errors.email ? 'border-red-500' : ''}`}
                placeholder="Enter your email"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-red-400 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`input-field ${errors.password ? 'border-red-500' : ''}`}
                placeholder="Enter your password"
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-red-400 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {/* Face Recognition Section */}
          {!showFaceRecognition ? (
            <div className="mt-6">
              <button
                onClick={() => setShowFaceRecognition(true)}
                className="w-full btn-secondary flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Login with Face Recognition
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="glass-card p-4 border border-cyan/50">
                <h3 className="text-lg font-bold text-gradient mb-4">Face Recognition Login</h3>
                
                {!modelsLoaded && (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan"></div>
                    <p className="mt-2 text-gray-400 text-sm">Loading face recognition models...</p>
                  </div>
                )}

                {modelsLoaded && (
                  <div className="space-y-4">
                    <div className="relative inline-block w-full">
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        width="320"
                        height="240"
                        className="w-full rounded-lg border border-gray-700"
                      />
                      <canvas
                        ref={canvasRef}
                        width="320"
                        height="240"
                        className="absolute top-0 left-0 w-full rounded-lg"
                      />
                    </div>

                    <div className="flex justify-center">
                      {!isScanning ? (
                        <button onClick={startScanning} className="btn-primary">
                          Start Face Scan
                        </button>
                      ) : (
                        <button onClick={stopScanning} className="btn-danger">
                          Stop Scanning
                        </button>
                      )}
                    </div>

                    {isScanning && (
                      <div className="text-center">
                        <div className="inline-block animate-pulse">
                          <div className="w-3 h-3 bg-cyan rounded-full"></div>
                        </div>
                        <p className="text-cyan mt-2 text-sm">Scanning for face...</p>
                      </div>
                    )}

                    {matchedUser && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-3 border border-green-500/50"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan to-amber rounded-full flex items-center justify-center">
                            <span className="text-black font-bold text-sm">
                              {matchedUser.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-sm">{matchedUser.name}</p>
                            <p className="text-xs text-gray-400">{matchedUser.department}</p>
                            <p className="text-xs text-green-400 mt-1 flex items-center">
                              <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Logging in...
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {!isScanning && !matchedUser && (
                      <p className="text-gray-400 text-xs text-center">
                        Position your face in the frame and click "Start Face Scan"
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setShowFaceRecognition(false);
                  stopScanning();
                }}
                className="w-full text-gray-400 hover:text-gray-300 text-sm transition-colors"
              >
                Back to Manual Login
              </button>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">
                Don't have an account?{' '}
                <Link to="/register" className="text-cyan hover:text-cyan/80 transition-colors">
                  Register here
                </Link>
              </p>
            </div>

            <div className="text-center">
              <Link 
                to="/attendance" 
                className="text-cyan hover:text-cyan/80 text-sm transition-colors"
              >
                Mark Attendance with Face Recognition
              </Link>
            </div>
          </div>

          <div className="mt-6 p-4 glass-card border border-gray-700">
            <h3 className="font-bold mb-2 text-amber text-sm">Demo Credentials</h3>
            <div className="text-xs space-y-1">
              <div>
                <span className="text-gray-400">Admin:</span>
                <span className="text-white ml-2">admin@company.com / Admin@123</span>
              </div>
              <div>
                <span className="text-gray-400">Employee:</span>
                <span className="text-white ml-2">Register an account first</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
