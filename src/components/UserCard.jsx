import React from 'react';

const UserCard = ({ user, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="user-card"
      style={{ '--user-color': user.color }}
    >
      <div className="user-avatar">
        {user.initials}
      </div>
      <div className="user-name">{user.name}</div>
    </button>
  );
};

export default UserCard;
