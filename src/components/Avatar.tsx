import React from 'react';

interface AvatarProps {
  username: string;
  profilePhoto?: string;
  size?: 'small' | 'medium' | 'large';
  showBorder?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ 
  username, 
  profilePhoto, 
  size = 'medium',
  showBorder = false 
}) => {
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/[\s_-]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getSize = (): number => {
    switch (size) {
      case 'small': return 32;
      case 'medium': return 40;
      case 'large': return 80;
      default: return 40;
    }
  };

  const getFontSize = (): number => {
    switch (size) {
      case 'small': return 12;
      case 'medium': return 14;
      case 'large': return 28;
      default: return 14;
    }
  };

  // Generate a consistent color based on username
  const getBackgroundColor = (name: string): string => {
    const colors = [
      '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
      '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a',
      '#ff9800', '#ff5722', '#795548', '#607d8b'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const sizeValue = getSize();

  const baseStyle: React.CSSProperties = {
    width: sizeValue,
    height: sizeValue,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: showBorder ? '2px solid #fff' : 'none',
    boxShadow: showBorder ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
  };

  if (profilePhoto) {
    return (
      <img
        src={profilePhoto}
        alt={`${username}'s avatar`}
        style={{
          ...baseStyle,
          objectFit: 'cover',
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...baseStyle,
        backgroundColor: getBackgroundColor(username),
        color: 'white',
        fontWeight: 'bold',
        fontSize: getFontSize(),
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {getInitials(username)}
    </div>
  );
};

export default Avatar;
