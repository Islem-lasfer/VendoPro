import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/currency';
import { 
  getAllEmployees, createEmployee, updateEmployee, deleteEmployee,
  getEmployeeLeave, createLeave, updateLeave, deleteLeave, calculateAccruedLeave,
  getEmployeeBonuses, createBonus, updateBonus, deleteBonus
} from '../../utils/database';
import Notification from '../../components/Notification/Notification';
import ConfirmDialog from '../../components/Notification/ConfirmDialog';
import NumericInput from '../../components/NumericInput/NumericInput';
import './Employees.css';

const Employees = () => {
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [notification, setNotification] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [employeeLeave, setEmployeeLeave] = useState([]);
  const [employeeBonuses, setEmployeeBonuses] = useState([]);
  
  const [formData, setFormData] = useState({
    name: '',
    position: '',
    salary: '',
    absences: 0,
    deduction: 0,
    nationalCard: '',
    insurance: '',
    phone: '',
    email: '',
    address: '',
    startDate: new Date().toISOString().split('T')[0]
  });

  const [leaveFormData, setLeaveFormData] = useState({
    leaveType: 'annual',
    startDate: '',
    endDate: '',
    days: 0,
    reason: '',
    status: 'approved'
  });

  const [bonusFormData, setBonusFormData] = useState({
    amount: '',
    reason: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [payslipFormData, setPayslipFormData] = useState({
    periodType: 'month',
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
  };

  const loadEmployees = async () => {
    setLoading(true);
    const result = await getAllEmployees();
    if (result.success) {
      setEmployees(result.data);
    } else {
      console.error('Failed to load employees:', result.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployeeDetails = async (employeeId) => {
    const leaveResult = await getEmployeeLeave(employeeId);
    const bonusResult = await getEmployeeBonuses(employeeId);
    
    if (leaveResult.success) {
      setEmployeeLeave(leaveResult.data);
    }
    if (bonusResult.success) {
      setEmployeeBonuses(bonusResult.data);
    }
  };

  const calculateNetSalary = (salary, deduction) => {
    return salary - deduction;
  };

  const calculateLeaveDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({ 
      name: '', 
      position: '', 
      salary: '', 
      absences: 0, 
      deduction: 0, 
      nationalCard: '', 
      insurance: '', 
      phone: '', 
      email: '', 
      address: '',
      startDate: new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const openEditModal = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name || '',
      position: employee.position || '',
      salary: employee.salary || '',
      absences: employee.absences || 0,
      deduction: employee.deduction || 0,
      nationalCard: employee.nationalCard || '',
      insurance: employee.insurance || '',
      phone: employee.phone || '',
      email: employee.email || '',
      address: employee.address || '',
      startDate: employee.startDate || new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
    setFormData({ 
      name: '', 
      position: '', 
      salary: '', 
      absences: 0, 
      deduction: 0, 
      nationalCard: '', 
      insurance: '', 
      phone: '', 
      email: '', 
      address: '',
      startDate: new Date().toISOString().split('T')[0]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const employeeData = {
      ...formData,
      salary: parseFloat(formData.salary) || 0,
      absences: parseInt(formData.absences) || 0,
      deduction: parseFloat(formData.deduction) || 0
    };

    if (editingEmployee) {
      const result = await updateEmployee(editingEmployee.id, employeeData);
      if (result.success) {
        await loadEmployees();
        closeModal();
        showNotification(t('employees.saveSuccess'), 'success');
      } else {
        showNotification(t('employees.error') + ': ' + result.error, 'error');
      }
    } else {
      const result = await createEmployee(employeeData);
      if (result.success) {
        await loadEmployees();
        closeModal();
        showNotification(t('employees.saveSuccess'), 'success');
      } else {
        showNotification(t('employees.error') + ': ' + result.error, 'error');
      }
    }
  };

  const handleDeleteEmployee = async (id) => {
    setConfirmDialog({
      message: t('employees.deleteConfirm'),
      onConfirm: async () => {
        try {
          const result = await deleteEmployee(id);
          if (result.success) {
            await loadEmployees();
            setConfirmDialog(null);
            showNotification(t('employees.deleteSuccess'), 'success');
          } else {
            setConfirmDialog(null);
            showNotification(t('employees.deleteFailed') + ': ' + result.error, 'error');
          }
        } catch (error) {
          setConfirmDialog(null);
          showNotification(t('employees.error') + ': ' + error.message, 'error');
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const updateAbsences = async (id, newAbsences) => {
    const employee = employees.find(emp => emp.id === id);
    if (employee) {
      const result = await updateEmployee(id, { ...employee, absences: Math.max(0, newAbsences) });
      if (result.success) {
        await loadEmployees();
      }
    }
  };

  const openEmployeeDetails = async (employee) => {
    setSelectedEmployee(employee);
    await loadEmployeeDetails(employee.id);
    setShowDetailsModal(true);
  };

  const openLeaveModal = () => {
    setLeaveFormData({
      leaveType: 'annual',
      startDate: '',
      endDate: '',
      days: 0,
      reason: '',
      status: 'approved'
    });
    setShowLeaveModal(true);
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    
    const leaveData = {
      employeeId: selectedEmployee.id,
      ...leaveFormData,
      days: parseFloat(leaveFormData.days) || 0
    };

    const result = await createLeave(leaveData);
    if (result.success) {
      await loadEmployeeDetails(selectedEmployee.id);
      setShowLeaveModal(false);
      showNotification('Leave added successfully', 'success');
    } else {
      showNotification('Failed to add leave: ' + result.error, 'error');
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    setConfirmDialog({
      message: t('employees.deleteLeaveConfirm'),
      onConfirm: async () => {
        const result = await deleteLeave(leaveId);
        if (result.success) {
          await loadEmployeeDetails(selectedEmployee.id);
          setConfirmDialog(null);
          showNotification('Leave deleted successfully', 'success');
        } else {
          setConfirmDialog(null);
          showNotification('Failed to delete leave', 'error');
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const openBonusModal = () => {
    setBonusFormData({
      amount: '',
      reason: '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowBonusModal(true);
  };

  const handleBonusSubmit = async (e) => {
    e.preventDefault();
    
    const bonusData = {
      employeeId: selectedEmployee.id,
      ...bonusFormData,
      amount: parseFloat(bonusFormData.amount) || 0
    };

    const result = await createBonus(bonusData);
    if (result.success) {
      await loadEmployeeDetails(selectedEmployee.id);
      setShowBonusModal(false);
      showNotification('Bonus added successfully', 'success');
    } else {
      showNotification('Failed to add bonus: ' + result.error, 'error');
    }
  };

  const handleDeleteBonus = async (bonusId) => {
    setConfirmDialog({
      message: t('employees.deleteBonusConfirm'),
      onConfirm: async () => {
        const result = await deleteBonus(bonusId);
        if (result.success) {
          await loadEmployeeDetails(selectedEmployee.id);
          setConfirmDialog(null);
          showNotification('Bonus deleted successfully', 'success');
        } else {
          setConfirmDialog(null);
          showNotification('Failed to delete bonus', 'error');
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleGeneratePayslip = async () => {
    if (!selectedEmployee) return;

    try {
      // Get shop settings from localStorage
      const shopSettings = JSON.parse(localStorage.getItem('shopSettings') || '{}');
      
      // Merge settings for payslip generation
      const payslipSettings = {
        ...settings,
        posName: shopSettings.posName || settings.posName || 'POS',
        email: shopSettings.email || settings.email || '',
        address: shopSettings.shopAddress || settings.shopAddress || '',
        phone: shopSettings.phone1 || settings.phone1 || '',
        taxId: shopSettings.taxId || settings.taxId || '',
        currency: settings.currency || 'USD'
      };

      const monthNames = [
        t('employees.january'), t('employees.february'), t('employees.march'),
        t('employees.april'), t('employees.may'), t('employees.june'),
        t('employees.july'), t('employees.august'), t('employees.september'),
        t('employees.october'), t('employees.november'), t('employees.december')
      ];

      const year = payslipFormData.year;

      if (payslipFormData.periodType === 'year') {
        // Generate annual payslip
        const yearBonuses = employeeBonuses.filter(bonus => {
          const bonusDate = new Date(bonus.date);
          return bonusDate.getFullYear() === year;
        });

        const yearLeave = employeeLeave.filter(leave => {
          const leaveStart = new Date(leave.startDate);
          const leaveEnd = new Date(leave.endDate);
          return leaveStart.getFullYear() === year || leaveEnd.getFullYear() === year;
        });

        const leaveDaysInYear = yearLeave.reduce((sum, leave) => sum + leave.days, 0);

        if (window.generatePayslip) {
          await window.generatePayslip(
            selectedEmployee,
            payslipSettings,
            t('employees.annual'),
            year,
            i18n.language,
            yearBonuses,
            leaveDaysInYear
          );
        } else {
          throw new Error('Payslip generator not loaded');
        }
      } else {
        // Generate monthly payslip
        const month = monthNames[payslipFormData.month];

        const monthBonuses = employeeBonuses.filter(bonus => {
          const bonusDate = new Date(bonus.date);
          return bonusDate.getMonth() === payslipFormData.month && 
                 bonusDate.getFullYear() === year;
        });

        const monthLeave = employeeLeave.filter(leave => {
          const leaveStart = new Date(leave.startDate);
          const leaveEnd = new Date(leave.endDate);
          const monthStart = new Date(year, payslipFormData.month, 1);
          const monthEnd = new Date(year, payslipFormData.month + 1, 0);
          
          return (leaveStart <= monthEnd && leaveEnd >= monthStart);
        });

        const leaveDaysInMonth = monthLeave.reduce((sum, leave) => sum + leave.days, 0);

        if (window.generatePayslip) {
          await window.generatePayslip(
            selectedEmployee,
            payslipSettings,
            month,
            year,
            i18n.language,
            monthBonuses,
            leaveDaysInMonth
          );
        } else {
          throw new Error('Payslip generator not loaded');
        }
      }

      setShowPayslipModal(false);
      showNotification(t('employees.payslipGenerated'), 'success');
    } catch (error) {
      console.error('Error generating payslip:', error);
      showNotification(t('employees.payslipError'), 'error');
    }
  };

  useEffect(() => {
    if (leaveFormData.startDate && leaveFormData.endDate) {
      const days = calculateLeaveDays(leaveFormData.startDate, leaveFormData.endDate);
      setLeaveFormData(prev => ({ ...prev, days }));
    }
  }, [leaveFormData.startDate, leaveFormData.endDate]);

  const getAccruedLeave = async (employee) => {
    if (!employee.startDate) return 0;
    const result = await calculateAccruedLeave(employee.startDate, 2); // 2 days per month
    return result.success ? result.data : 0;
  };

  const getUsedLeave = (employeeId) => {
    const leaves = employeeLeave.filter(l => l.employeeId === employeeId && l.status === 'approved');
    return leaves.reduce((sum, leave) => sum + leave.days, 0);
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="employees-page">
      <div className="page-header">
        <h1 className="page-title">{t('employees.title')}</h1>
        <button className="add-btn primary-btn" onClick={openAddModal}>
          ➕ {t('employees.addEmployee')}
        </button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder={t('employees.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="search-icon">🔍</span>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-icon">👥</div>
          <div className="summary-content">
            <p className="summary-label">{t('employees.totalEmployees')}</p>
            <h3 className="summary-value">{employees.length}</h3>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">💵</div>
          <div className="summary-content">
            <p className="summary-label">{t('employees.totalSalaries')}</p>
            <h3 className="summary-value">
              {formatCurrency(employees.reduce((sum, emp) => sum + calculateNetSalary(emp.salary, emp.deduction || 0), 0), settings.currency)}
            </h3>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">💰</div>
          <div className="summary-content">
            <p className="summary-label">{t('employees.averageSalary')}</p>
            <h3 className="summary-value">
              {employees.length > 0 ? formatCurrency(employees.reduce((sum, emp) => sum + calculateNetSalary(emp.salary, emp.deduction || 0), 0) / employees.length, settings.currency) : formatCurrency(0, settings.currency)}
            </h3>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">⚠️</div>
          <div className="summary-content">
            <p className="summary-label">{t('employees.totalAbsences')}</p>
            <h3 className="summary-value">
              {employees.reduce((sum, emp) => sum + emp.absences, 0)}
            </h3>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">📉</div>
          <div className="summary-content">
            <p className="summary-label">{t('employees.totalDeductions')}</p>
            <h3 className="summary-value">
              {formatCurrency(employees.reduce((sum, emp) => sum + (emp.deduction || 0), 0), settings.currency)}
            </h3>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">💸</div>
          <div className="summary-content">
            <p className="summary-label">{t('employees.grossSalaries')}</p>
            <h3 className="summary-value">
              {formatCurrency(employees.reduce((sum, emp) => sum + emp.salary, 0), settings.currency)}
            </h3>
          </div>
        </div>
      </div>

      <div className="employees-table-container">
        <table className="employees-table">
          <thead>
            <tr>
              <th>{t('employees.name')}</th>
              <th>{t('employees.position')}</th>
              <th>{t('employees.salary')}</th>
              <th>{t('employees.absences')}</th>
              <th>{t('employees.deduction')}</th>
              <th>{t('employees.netSalary')}</th>
              <th>{t('employees.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((employee) => {
              const deduction = employee.deduction || 0;
              const netSalary = calculateNetSalary(employee.salary, deduction);
              
              return (
                <tr key={employee.id}>
                  <td className="employee-name">{employee.name}</td>
                  <td>{employee.position}</td>
                  <td className="salary">{formatCurrency(employee.salary, settings.currency)}</td>
                  <td>
                    <div className="absences-control">
                      <button
                        className="absence-btn"
                        onClick={() => updateAbsences(employee.id, employee.absences - 1)}
                      >
                        -
                      </button>
                      <span className="absence-count">{employee.absences}</span>
                      <button
                        className="absence-btn"
                        onClick={() => updateAbsences(employee.id, employee.absences + 1)}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="deduction">-{formatCurrency(deduction, settings.currency)}</td>
                  <td className="net-salary">{formatCurrency(netSalary, settings.currency)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="view-btn-small"
                        onClick={() => openEmployeeDetails(employee)}
                        title={t('employees.viewDetails')}
                      >
                        👁️
                      </button>
                      <button
                        className="edit-btn-small"
                        onClick={() => openEditModal(employee)}
                      >
                        ✏️
                      </button>
                      <button
                        className="delete-btn-small"
                        onClick={() => handleDeleteEmployee(employee.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Employee Form Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingEmployee ? t('employees.edit') + ' ' + t('employees.name') : t('employees.addEmployee')}</h2>
              <button className="close-btn" onClick={closeModal}>✕</button>
            </div>
            <form className="employee-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('employees.name')}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t('employees.position')}</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('employees.salary')}</label>
                  <NumericInput
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>{t('employees.startDate')}</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('employees.absences')}</label>
                  <NumericInput
                    min="0"
                    value={formData.absences}
                    onChange={(e) => setFormData({ ...formData, absences: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label>{t('employees.deduction')}</label>
                  <NumericInput
                    min="0"
                    step="0.01"
                    value={formData.deduction}
                    onChange={(e) => setFormData({ ...formData, deduction: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('employees.nationalCard')}</label>
                  <input
                    type="text"
                    value={formData.nationalCard}
                    onChange={(e) => setFormData({ ...formData, nationalCard: e.target.value })}
                    placeholder={t('employees.enterNationalCard')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('employees.insurance')}</label>
                  <input
                    type="text"
                    value={formData.insurance}
                    onChange={(e) => setFormData({ ...formData, insurance: e.target.value })}
                    placeholder={t('employees.enterInsurance')}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('employees.phone')}</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder={t('employees.enterPhone')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('employees.email')}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t('employees.enterEmail')}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>{t('employees.address')}</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={t('employees.enterAddress')}
                  rows="2"
                />
              </div>
              <div className="deduction-info">
                <p className="net-salary-preview">
                  {t('employees.netSalaryPreview')} {formatCurrency(calculateNetSalary(formData.salary || 0, formData.deduction || 0), settings.currency)}
                </p>
              </div>
              <button type="submit" className="submit-btn primary-btn">
                {t('employees.save')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Employee Details Modal */}
      {showDetailsModal && selectedEmployee && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content employee-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('employees.employeeDetails')}: {selectedEmployee.name}</h2>
              <button className="close-btn" onClick={() => setShowDetailsModal(false)}>✕</button>
            </div>
            
            <div className="details-content">
              <div className="details-section">
                <h3>{t('employees.employeeInfo')}</h3>
                <div className="details-grid">
                  <div><strong>{t('employees.position')}:</strong> {selectedEmployee.position}</div>
                  <div><strong>{t('employees.salary')}:</strong> {formatCurrency(selectedEmployee.salary, settings.currency)}</div>
                  <div><strong>{t('employees.startDate')}:</strong> {selectedEmployee.startDate}</div>
                  <div><strong>{t('employees.phone')}:</strong> {selectedEmployee.phone || 'N/A'}</div>
                  <div><strong>{t('employees.email')}:</strong> {selectedEmployee.email || 'N/A'}</div>
                  <div><strong>{t('employees.nationalCard')}:</strong> {selectedEmployee.nationalCard || 'N/A'}</div>
                </div>
              </div>

              {/* Leave Management Section */}
              <div className="details-section">
                <div className="section-header">
                  <h3>{t('employees.leaveManagement')}</h3>
                  <button className="add-btn-small primary-btn" onClick={openLeaveModal}>
                    ➕ {t('employees.addLeave')}
                  </button>
                </div>
                
                <div className="leave-summary">
                  <div className="leave-stat">
                    <span className="leave-label">{t('employees.accruedLeave')}:</span>
                    <span className="leave-value">{selectedEmployee.leaveBalance || 0} {t('employees.days')}</span>
                  </div>
                  <div className="leave-stat">
                    <span className="leave-label">{t('employees.usedLeave')}:</span>
                    <span className="leave-value">{getUsedLeave(selectedEmployee.id)} {t('employees.days')}</span>
                  </div>
                </div>

                <div className="table-container">
                  <table className="details-table">
                    <thead>
                      <tr>
                        <th>{t('employees.leaveType')}</th>
                        <th>{t('employees.startLeaveDate')}</th>
                        <th>{t('employees.endLeaveDate')}</th>
                        <th>{t('employees.leaveDays')}</th>
                        <th>{t('employees.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeLeave.map((leave) => (
                        <tr key={leave.id}>
                          <td>{t(`employees.${leave.leaveType}`)}</td>
                          <td>{leave.startDate}</td>
                          <td>{leave.endDate}</td>
                          <td>{leave.days}</td>
                          <td>
                            <button
                              className="delete-btn-small"
                              onClick={() => handleDeleteLeave(leave.id)}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bonus Management Section */}
              <div className="details-section">
                <div className="section-header">
                  <h3>{t('employees.bonusManagement')}</h3>
                  <button className="add-btn-small primary-btn" onClick={openBonusModal}>
                    ➕ {t('employees.addBonus')}
                  </button>
                </div>
                
                <div className="bonus-summary">
                  <div className="bonus-stat">
                    <span className="bonus-label">{t('employees.totalBonuses')}:</span>
                    <span className="bonus-value">
                      {formatCurrency(employeeBonuses.reduce((sum, b) => sum + b.amount, 0), settings.currency)}
                    </span>
                  </div>
                </div>

                <div className="table-container">
                  <table className="details-table">
                    <thead>
                      <tr>
                        <th>{t('employees.bonusDate')}</th>
                        <th>{t('employees.bonusAmount')}</th>
                        <th>{t('employees.bonusReason')}</th>
                        <th>{t('employees.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeBonuses.map((bonus) => (
                        <tr key={bonus.id}>
                          <td>{bonus.date}</td>
                          <td>{formatCurrency(bonus.amount, settings.currency)}</td>
                          <td>{bonus.reason || '-'}</td>
                          <td>
                            <button
                              className="delete-btn-small"
                              onClick={() => handleDeleteBonus(bonus.id)}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payslip Generation Section */}
              <div className="details-section">
                <div className="section-header">
                  <h3>{t('employees.generatePayslip')}</h3>
                  <button 
                    className="primary-btn"
                    onClick={() => setShowPayslipModal(true)}
                  >
                    📄 {t('employees.generatePayslip')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leave Form Modal */}
      {showLeaveModal && (
        <div className="modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="modal-content small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('employees.addLeave')}</h2>
              <button className="close-btn" onClick={() => setShowLeaveModal(false)}>✕</button>
            </div>
            <form onSubmit={handleLeaveSubmit}>
              <div className="form-group">
                <label>{t('employees.leaveType')}</label>
                <select
                  value={leaveFormData.leaveType}
                  onChange={(e) => setLeaveFormData({ ...leaveFormData, leaveType: e.target.value })}
                  required
                >
                  <option value="annual">{t('employees.annual')}</option>
                  <option value="sick">{t('employees.sick')}</option>
                  <option value="personal">{t('employees.personal')}</option>
                  <option value="unpaid">{t('employees.unpaid')}</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('employees.startLeaveDate')}</label>
                  <input
                    type="date"
                    value={leaveFormData.startDate}
                    onChange={(e) => setLeaveFormData({ ...leaveFormData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t('employees.endLeaveDate')}</label>
                  <input
                    type="date"
                    value={leaveFormData.endDate}
                    onChange={(e) => setLeaveFormData({ ...leaveFormData, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>{t('employees.leaveDays')}</label>
                <input
                  type="number"
                  value={leaveFormData.days}
                  readOnly
                  className="readonly-input"
                />
              </div>
              <div className="form-group">
                <label>{t('employees.leaveReason')}</label>
                <textarea
                  value={leaveFormData.reason}
                  onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                  rows="3"
                />
              </div>
              <button type="submit" className="submit-btn primary-btn">
                {t('employees.save')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bonus Form Modal */}
      {showBonusModal && (
        <div className="modal-overlay" onClick={() => setShowBonusModal(false)}>
          <div className="modal-content small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('employees.addBonus')}</h2>
              <button className="close-btn" onClick={() => setShowBonusModal(false)}>✕</button>
            </div>
            <form onSubmit={handleBonusSubmit}>
              <div className="form-group">
                <label>{t('employees.bonusAmount')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={bonusFormData.amount}
                  onChange={(e) => setBonusFormData({ ...bonusFormData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('employees.bonusReason')}</label>
                <textarea
                  value={bonusFormData.reason}
                  onChange={(e) => setBonusFormData({ ...bonusFormData, reason: e.target.value })}
                  rows="3"
                  placeholder="Performance bonus, project completion, etc."
                />
              </div>
              <div className="form-group">
                <label>{t('employees.bonusDate')}</label>
                <input
                  type="date"
                  value={bonusFormData.date}
                  onChange={(e) => setBonusFormData({ ...bonusFormData, date: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="submit-btn primary-btn">
                {t('employees.save')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Payslip Generation Modal */}
      {showPayslipModal && selectedEmployee && (
        <div className="modal-overlay" onClick={() => setShowPayslipModal(false)}>
          <div className="modal-content small-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('employees.generatePayslip')}</h2>
              <button className="close-btn" onClick={() => setShowPayslipModal(false)}>✕</button>
            </div>
            <div className="payslip-form">
              <div className="form-group">
                <label>{t('employees.periodType')}</label>
                <select
                  value={payslipFormData.periodType}
                  onChange={(e) => setPayslipFormData({ ...payslipFormData, periodType: e.target.value })}
                >
                  <option value="month">{t('employees.monthly')}</option>
                  <option value="year">{t('employees.yearly')}</option>
                </select>
              </div>
              {payslipFormData.periodType === 'month' && (
                <div className="form-group">
                  <label>{t('employees.selectMonth')}</label>
                  <select
                    value={payslipFormData.month}
                    onChange={(e) => setPayslipFormData({ ...payslipFormData, month: parseInt(e.target.value) })}
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => (
                      <option key={m} value={m}>
                        {t(`employees.${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][m]}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>{t('employees.selectYear')}</label>
                <input
                  type="number"
                  value={payslipFormData.year}
                  onChange={(e) => setPayslipFormData({ ...payslipFormData, year: parseInt(e.target.value) })}
                  min="2020"
                  max="2030"
                />
              </div>
              <button className="submit-btn primary-btn" onClick={handleGeneratePayslip}>
                📄 {t('employees.generatePayslip')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {notification && (
        <Notification 
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      
      {confirmDialog && (
        <ConfirmDialog 
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
        />
      )}
    </div>
  );
};

export default Employees;
