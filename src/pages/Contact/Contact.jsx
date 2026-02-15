import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Contact.css';
import { notify } from '../../utils/notifications';

const { ipcRenderer } = window.require ? window.require('electron') : {};

const Contact = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      notify('Please fill in all fields', 'warning');
      return;
    }
    
    // Create mailto link with form data
    const recipient = 'islamsifou2002@gmail.com';
    const subject = encodeURIComponent(formData.subject);
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
    );
    const mailtoLink = `mailto:${recipient}?subject=${subject}&body=${body}`;
    
    // Use Electron shell to open default email client
    if (ipcRenderer) {
      ipcRenderer.send('open-email', mailtoLink);
    } else {
      // Fallback for web browser
      window.open(mailtoLink, '_blank');
    }
    
    // Show success message
    notify('Email client opened! Please send the email from your email application.', 'success');
    
    // Reset form
    setFormData({
      name: '',
      email: '',
      subject: '',
      message: ''
    });
  };

  return (
    <div className="contact-page">
      <div className="page-header">
        <h1 className="page-title">{t('contact.title')}</h1>
        <p className="page-subtitle">{t('contact.subtitle')}</p>
      </div>

      <div className="contact-container">
        <div className="contact-info">
          <div className="info-card">
            <div className="info-icon">📧</div>
            <h3>{t('contact.email')}</h3>
            <a href="mailto:islamsifou2002@gmail.com" className="contact-link">
              islamsifou2002@gmail.com
            </a>
          </div>

          <div className="info-card">
            <div className="info-icon">🚀</div>
            <h3>{t('contact.support')}</h3>
            <p>{t('contact.supportText')}</p>
          </div>
        </div>

        <div className="contact-form-section">
          <h2>{t('contact.sendMessage')}</h2>
          <form onSubmit={handleSubmit} className="contact-form">
            <div className="form-group">
              <label>{t('contact.name')}</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder={t('contact.namePlaceholder')}
              />
            </div>

            <div className="form-group">
              <label>{t('contact.yourEmail')}</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder={t('contact.emailPlaceholder')}
              />
            </div>

            <div className="form-group">
              <label>{t('contact.subject')}</label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                placeholder={t('contact.subjectPlaceholder')}
              />
            </div>

            <div className="form-group">
              <label>{t('contact.message')}</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows="6"
                placeholder={t('contact.messagePlaceholder')}
              ></textarea>
            </div>

            <button type="submit" className="submit-btn">
              {t('contact.send')} 📤
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;
