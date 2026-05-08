import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Don't show header on landing page
  if (location.pathname === '/') {
    return null;
  }

  return (
    <header className="glass-card sticky top-0 z-40 border-b border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-cyan rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-xl">F</span>
            </div>
            <h1 className="text-xl font-bold text-gradient">FACEMARK</h1>
          </Link>

          {currentUser && (
            <div className="flex items-center space-x-4">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium">{currentUser.name}</p>
                <p className="text-xs text-gray-400 capitalize">{currentUser.role}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-cyan to-amber rounded-full flex items-center justify-center">
                <span className="text-black font-bold">
                  {currentUser.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="btn-secondary text-sm px-4 py-2"
              >
                Logout
              </button>
            </div>
          )}

          {!currentUser && location.pathname !== '/login' && (
            <Link to="/login" className="btn-primary text-sm px-4 py-2">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
