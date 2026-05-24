import React from 'react';
import './PageHeader.css';

const PageHeader = ({ title, subtitle }) => (
  <div className="page-header">
    <h2 className="page-header-title">{title}</h2>
    {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
  </div>
);

export default PageHeader;
