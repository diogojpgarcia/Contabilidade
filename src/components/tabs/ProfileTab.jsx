import React, { useState, useEffect } from 'react';
import { dbService } from '../../lib/supabase';
import CategoryManager from '../CategoryManager';
import './ProfileTab.css';

const ProfileTab = ({ user, userName, onLogout }) => {
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [travelGoal, setTravelGoal] = useState({
    name: '',
    amount: 0,
    targetDate: '',
    currentSavings: 0
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(null);

  useEffect(() => {
    loadTravelGoal();
  }, [user]);

  const loadTravelGoal = async () => {
    try {
      const settings = await dbService.getUserSettings(user.id);
      if (settings?.travel_goal) {
        setTravelGoal(settings.travel_goal);
      }
    } catch (error) {
      console.error('Error loading travel goal:', error);
    }
  };

  const saveTravelGoal = async (goal) => {
    try {
      await dbService.updateUserSettings(user.id, {
        travel_goal: goal
      });
      setTravelGoal(goal);
      setEditingGoal(false);
      setTempGoal(null);
    } catch (error) {
      console.error('Error saving travel goal:', error);
      alert('Erro ao guardar objetivo: ' + error.message);
    }
  };

  const handleStartEditing = () => {
    setTempGoal({ ...travelGoal });
    setEditingGoal(true);
  };

  const handleCancelEditing = () => {
    setTempGoal(null);
    setEditingGoal(false);
  };

  const handleSaveGoal = () => {
    if (!tempGoal.name.trim()) {
      alert('Nome do objetivo é obrigatório!');
      return;
    }
    if (tempGoal.amount <= 0) {
      alert('Valor da meta deve ser maior que zero!');
      return;
    }
    saveTravelGoal(tempGoal);
  };

  const calculateProgress = () => {
    if (travelGoal.amount <= 0) return 0;
    return Math.min((travelGoal.currentSavings / travelGoal.amount) * 100, 100);
  };

  const calculateDaysRemaining = () => {
    if (!travelGoal.targetDate) return null;
    const target = new Date(travelGoal.targetDate);
    const today = new Date();
    const diff = target - today;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const calculateMonthlySavings = () => {
    const remaining = travelGoal.amount - travelGoal.currentSavings;
    const days = calculateDaysRemaining();
    if (!days || days === 0) return 0;
    const months = days / 30;
    return remaining / months;
  };

  const progress = calculateProgress();
  const daysRemaining = calculateDaysRemaining();
  const monthlySavings = calculateMonthlySavings();
  const hasGoal = travelGoal.name && travelGoal.amount > 0;

  return (
    <div className="profile-tab">
      {/* User Info */}
      <div className="user-info-section">
        <div className="user-avatar-large">
          {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <h2 className="user-name">{userName}</h2>
        <p className="user-email">{user.email}</p>
      </div>

      {/* Travel Goal */}
      <div className="profile-section">
        <h3 className="section-title">✈️ Objetivo de Viagem</h3>
        
        {!editingGoal && !hasGoal && (
          <div className="empty-goal">
            <div className="empty-icon">🌍</div>
            <p>Ainda não tens um objetivo definido</p>
            <button className="btn-primary" onClick={handleStartEditing}>
              ➕ Criar Objetivo
            </button>
          </div>
        )}

        {!editingGoal && hasGoal && (
          <div className="goal-display">
            <div className="goal-header">
              <h4 className="goal-name">{travelGoal.name}</h4>
              <button className="btn-edit-small" onClick={handleStartEditing}>
                ✏️
              </button>
            </div>

            <div className="goal-meta">
              <div className="goal-meta-item">
                <span className="meta-label">Meta</span>
                <span className="meta-value">{travelGoal.amount.toFixed(2)}€</span>
              </div>
              {travelGoal.targetDate && (
                <div className="goal-meta-item">
                  <span className="meta-label">Data</span>
                  <span className="meta-value">
                    {new Date(travelGoal.targetDate).toLocaleDateString('pt-PT')}
                  </span>
                </div>
              )}
            </div>

            <div className="goal-progress-container">
              <div className="goal-progress-bar">
                <div 
                  className="goal-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="goal-progress-text">
                {travelGoal.currentSavings.toFixed(2)}€ / {travelGoal.amount.toFixed(2)}€
                <span className="goal-percentage">({progress.toFixed(1)}%)</span>
              </div>
            </div>

            {daysRemaining !== null && daysRemaining > 0 && (
              <div className="goal-stats">
                <div className="goal-stat">
                  <span className="stat-value">{daysRemaining}</span>
                  <span className="stat-label">dias restantes</span>
                </div>
                {monthlySavings > 0 && (
                  <div className="goal-stat">
                    <span className="stat-value">{monthlySavings.toFixed(2)}€</span>
                    <span className="stat-label">poupar/mês</span>
                  </div>
                )}
              </div>
            )}

            {progress >= 100 && (
              <div className="goal-achieved">
                🎉 Objetivo alcançado! Boa viagem!
              </div>
            )}

            <div className="goal-savings-input">
              <label>Poupanças Atuais:</label>
              <div className="savings-input-group">
                <input
                  type="number"
                  value={travelGoal.currentSavings}
                  onChange={(e) => {
                    const updated = { ...travelGoal, currentSavings: parseFloat(e.target.value) || 0 };
                    saveTravelGoal(updated);
                  }}
                  step="0.01"
                  min="0"
                />
                <span className="currency">€</span>
              </div>
            </div>
          </div>
        )}

        {editingGoal && (
          <div className="goal-form">
            <div className="form-group">
              <label>Nome do Objetivo</label>
              <input
                type="text"
                value={tempGoal.name}
                onChange={(e) => setTempGoal({ ...tempGoal, name: e.target.value })}
                placeholder="Ex: Viagem a Bali"
              />
            </div>

            <div className="form-group">
              <label>Valor Meta</label>
              <div className="input-with-currency">
                <input
                  type="number"
                  value={tempGoal.amount}
                  onChange={(e) => setTempGoal({ ...tempGoal, amount: parseFloat(e.target.value) || 0 })}
                  step="100"
                  min="0"
                />
                <span className="currency">€</span>
              </div>
            </div>

            <div className="form-group">
              <label>Data Alvo</label>
              <input
                type="date"
                value={tempGoal.targetDate}
                onChange={(e) => setTempGoal({ ...tempGoal, targetDate: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Poupanças Atuais</label>
              <div className="input-with-currency">
                <input
                  type="number"
                  value={tempGoal.currentSavings}
                  onChange={(e) => setTempGoal({ ...tempGoal, currentSavings: parseFloat(e.target.value) || 0 })}
                  step="0.01"
                  min="0"
                />
                <span className="currency">€</span>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={handleCancelEditing}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleSaveGoal}>
                💾 Guardar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="profile-section">
        <button 
          className="profile-option"
          onClick={() => setShowCategoryManager(true)}
        >
          <span className="option-icon">🏷️</span>
          <span className="option-label">Gerir Categorias</span>
          <span className="option-arrow">→</span>
        </button>
      </div>

      {/* Logout */}
      <div className="profile-section">
        <button className="btn-logout" onClick={onLogout}>
          🚪 Terminar Sessão
        </button>
      </div>

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <CategoryManager
          userId={user.id}
          onClose={() => setShowCategoryManager(false)}
          onUpdate={(newCategories) => {
            console.log('Categories updated:', newCategories);
          }}
        />
      )}
    </div>
  );
};

export default ProfileTab;
