// Payslip PDF Generator
// This file generates professional payslips in multiple languages

/**
 * Generate a payslip PDF in multiple languages
 * @param {Object} employee - Employee data
 * @param {Object} settings - Company settings (name, email, address, etc.)
 * @param {string} month - Month (e.g., "January")
 * @param {number} year - Year (e.g., 2024)
 * @param {string} language - Language code (en, fr, ar, etc.)
 * @param {Array} bonuses - Array of bonuses for this month
 * @param {number} leaveDays - Leave days taken this month
 */
async function generatePayslip(employee, settings, month, year, language = 'en', bonuses = [], leaveDays = 0) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Load custom font for international support if available
  try {
    const { loadPdfFonts } = await import('../src/utils/pdfFonts.js');
    await loadPdfFonts(doc);
  } catch (e) {
    console.log('Using default font');
  }

  // Translation object for all languages
  const translations = {
    en: {
      title: 'PAYSLIP',
      employeeInfo: 'Employee Information',
      companyInfo: 'Company Information',
      period: 'Period',
      name: 'Name',
      position: 'Position',
      employeeId: 'Employee ID',
      nationalCard: 'National ID',
      insurance: 'Insurance Number',
      phone: 'Phone',
      email: 'Email',
      address: 'Address',
      startDate: 'Start Date',
      companyName: 'Company Name',
      companyEmail: 'Email',
      companyAddress: 'Address',
      earnings: 'EARNINGS',
      deductions: 'DEDUCTIONS',
      baseSalary: 'Base Salary',
      bonuses: 'Bonuses',
      totalBonuses: 'Total Bonuses',
      totalEarnings: 'Total Earnings',
      deduction: 'Deduction',
      leaveDays: 'Leave Days',
      leaveDeduction: 'Leave Deduction',
      totalDeductions: 'Total Deductions',
      netSalary: 'NET SALARY',
      paymentDate: 'Payment Date',
      signature: 'Employer Signature',
      employeeSignature: 'Employee Signature',
      footer: 'This is a computer-generated payslip'
    },
    fr: {
      title: 'FICHE DE PAIE',
      employeeInfo: 'Informations de l\'employé',
      companyInfo: 'Informations de l\'entreprise',
      period: 'Période',
      name: 'Nom',
      position: 'Poste',
      employeeId: 'ID Employé',
      nationalCard: 'Carte Nationale',
      insurance: 'Numéro d\'Assurance',
      phone: 'Téléphone',
      email: 'Email',
      address: 'Adresse',
      startDate: 'Date de Début',
      companyName: 'Nom de l\'Entreprise',
      companyEmail: 'Email',
      companyAddress: 'Adresse',
      earnings: 'RÉMUNÉRATIONS',
      deductions: 'RETRAITS / COTISATIONS',
      baseSalary: 'Salaire de base',
      bonuses: 'Primes',
      totalBonuses: 'Total des primes',
      totalEarnings: 'Total des gains',
      deduction: 'Déduction',
      leaveDays: 'Jours de congé',
      leaveDeduction: 'Déduction congé',
      totalDeductions: 'Total déductions',
      netSalary: 'SALAIRE NET',
      paymentDate: 'Date de paiement',
      signature: 'Signature et cachet de l\'employeur',
      employeeSignature: 'Signature de l\'employé',
      footer: 'Fiche de paie générée automatiquement — conserver comme justificatif de rémunération (document confidentiel)'
    },
    ar: {
      title: 'قسيمة الراتب',
      employeeInfo: 'معلومات الموظف',
      companyInfo: 'معلومات الشركة',
      period: 'الفترة',
      name: 'الاسم',
      position: 'المنصب',
      employeeId: 'رقم الموظف',
      nationalCard: 'البطاقة الوطنية',
      insurance: 'رقم التأمين',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      address: 'العنوان',
      startDate: 'تاريخ البدء',
      companyName: 'اسم الشركة',
      companyEmail: 'البريد الإلكتروني',
      companyAddress: 'العنوان',
      earnings: 'المكاسب',
      deductions: 'الخصومات',
      baseSalary: 'الراتب الأساسي',
      bonuses: 'المكافآت',
      totalBonuses: 'مجموع المكافآت',
      totalEarnings: 'إجمالي المكاسب',
      deduction: 'الخصم',
      leaveDays: 'أيام الإجازة',
      leaveDeduction: 'خصم الإجازة',
      totalDeductions: 'إجمالي الخصومات',
      netSalary: 'صافي الراتب',
      paymentDate: 'تاريخ الدفع',
      signature: 'توقيع صاحب العمل',
      employeeSignature: 'توقيع الموظف',
      footer: 'هذه قسيمة راتب إلكترونية'
    },
    es: {
      title: 'NÓMINA',
      employeeInfo: 'Información del Empleado',
      companyInfo: 'Información de la Empresa',
      period: 'Período',
      name: 'Nombre',
      position: 'Puesto',
      employeeId: 'ID Empleado',
      nationalCard: 'DNI',
      insurance: 'Número de Seguro',
      phone: 'Teléfono',
      email: 'Email',
      address: 'Dirección',
      startDate: 'Fecha de Inicio',
      companyName: 'Nombre de la Empresa',
      companyEmail: 'Email',
      companyAddress: 'Dirección',
      earnings: 'INGRESOS',
      deductions: 'DEDUCCIONES',
      baseSalary: 'Salario Base',
      bonuses: 'Bonificaciones',
      totalBonuses: 'Total Bonificaciones',
      totalEarnings: 'Total Ingresos',
      deduction: 'Deducción',
      leaveDays: 'Días de Vacaciones',
      leaveDeduction: 'Deducción por Vacaciones',
      totalDeductions: 'Total Deducciones',
      netSalary: 'SALARIO NETO',
      paymentDate: 'Fecha de Pago',
      signature: 'Firma del Empleador',
      employeeSignature: 'Firma del Empleado',
      footer: 'Esta es una nómina generada por computadora'
    },
    de: {
      title: 'GEHALTSABRECHNUNG',
      employeeInfo: 'Mitarbeiterinformationen',
      companyInfo: 'Unternehmensinformationen',
      period: 'Zeitraum',
      name: 'Name',
      position: 'Position',
      employeeId: 'Mitarbeiter-ID',
      nationalCard: 'Personalausweis',
      insurance: 'Versicherungsnummer',
      phone: 'Telefon',
      email: 'E-Mail',
      address: 'Adresse',
      startDate: 'Startdatum',
      companyName: 'Firmenname',
      companyEmail: 'E-Mail',
      companyAddress: 'Adresse',
      earnings: 'EINKOMMEN',
      deductions: 'ABZÜGE',
      baseSalary: 'Grundgehalt',
      bonuses: 'Boni',
      totalBonuses: 'Gesamt Boni',
      totalEarnings: 'Gesamteinkommen',
      deduction: 'Abzug',
      leaveDays: 'Urlaubstage',
      leaveDeduction: 'Urlaubsabzug',
      totalDeductions: 'Gesamt Abzüge',
      netSalary: 'NETTOGEHALT',
      paymentDate: 'Zahlungsdatum',
      signature: 'Arbeitgebersignatur',
      employeeSignature: 'Mitarbeitersignatur',
      footer: 'Dies ist eine computergenerierte Gehaltsabrechnung'
    },
    it: {
      title: 'BUSTA PAGA',
      employeeInfo: 'Informazioni Dipendente',
      companyInfo: 'Informazioni Azienda',
      period: 'Periodo',
      name: 'Nome',
      position: 'Posizione',
      employeeId: 'ID Dipendente',
      nationalCard: 'Carta d\'Identità',
      insurance: 'Numero Assicurazione',
      phone: 'Telefono',
      email: 'Email',
      address: 'Indirizzo',
      startDate: 'Data di Inizio',
      companyName: 'Nome Azienda',
      companyEmail: 'Email',
      companyAddress: 'Indirizzo',
      earnings: 'GUADAGNI',
      deductions: 'DETRAZIONI',
      baseSalary: 'Stipendio Base',
      bonuses: 'Bonus',
      totalBonuses: 'Totale Bonus',
      totalEarnings: 'Totale Guadagni',
      deduction: 'Detrazione',
      leaveDays: 'Giorni di Ferie',
      leaveDeduction: 'Detrazione Ferie',
      totalDeductions: 'Totale Detrazioni',
      netSalary: 'STIPENDIO NETTO',
      paymentDate: 'Data di Pagamento',
      signature: 'Firma Datore di Lavoro',
      employeeSignature: 'Firma Dipendente',
      footer: 'Questa è una busta paga generata al computer'
    },
    pt: {
      title: 'RECIBO DE PAGAMENTO',
      employeeInfo: 'Informações do Funcionário',
      companyInfo: 'Informações da Empresa',
      period: 'Período',
      name: 'Nome',
      position: 'Cargo',
      employeeId: 'ID Funcionário',
      nationalCard: 'Cartão Nacional',
      insurance: 'Número do Seguro',
      phone: 'Telefone',
      email: 'Email',
      address: 'Endereço',
      startDate: 'Data de Início',
      companyName: 'Nome da Empresa',
      companyEmail: 'Email',
      companyAddress: 'Endereço',
      earnings: 'GANHOS',
      deductions: 'DEDUÇÕES',
      baseSalary: 'Salário Base',
      bonuses: 'Bônus',
      totalBonuses: 'Total Bônus',
      totalEarnings: 'Total Ganhos',
      deduction: 'Dedução',
      leaveDays: 'Dias de Férias',
      leaveDeduction: 'Dedução de Férias',
      totalDeductions: 'Total Deduções',
      netSalary: 'SALÁRIO LÍQUIDO',
      paymentDate: 'Data de Pagamento',
      signature: 'Assinatura do Empregador',
      employeeSignature: 'Assinatura do Funcionário',
      footer: 'Este é um recibo de pagamento gerado por computador'
    },
    ru: {
      title: 'РАСЧЕТНЫЙ ЛИСТОК',
      employeeInfo: 'Информация о сотруднике',
      companyInfo: 'Информация о компании',
      period: 'Период',
      name: 'Имя',
      position: 'Должность',
      employeeId: 'ID сотрудника',
      nationalCard: 'Паспорт',
      insurance: 'Страховой номер',
      phone: 'Телефон',
      email: 'Email',
      address: 'Адрес',
      startDate: 'Дата начала',
      companyName: 'Название компании',
      companyEmail: 'Email',
      companyAddress: 'Адрес',
      earnings: 'ДОХОДЫ',
      deductions: 'УДЕРЖАНИЯ',
      baseSalary: 'Базовый оклад',
      bonuses: 'Премии',
      totalBonuses: 'Всего премий',
      totalEarnings: 'Всего доходов',
      deduction: 'Удержание',
      leaveDays: 'Дни отпуска',
      leaveDeduction: 'Вычет за отпуск',
      totalDeductions: 'Всего удержаний',
      netSalary: 'ЧИСТАЯ ЗАРПЛАТА',
      paymentDate: 'Дата выплаты',
      signature: 'Подпись работодателя',
      employeeSignature: 'Подпись сотрудника',
      footer: 'Это компьютерный расчетный листок'
    },
    zh: {
      title: '工资单',
      employeeInfo: '员工信息',
      companyInfo: '公司信息',
      period: '期间',
      name: '姓名',
      position: '职位',
      employeeId: '员工编号',
      nationalCard: '身份证',
      insurance: '保险号',
      phone: '电话',
      email: '邮箱',
      address: '地址',
      startDate: '入职日期',
      companyName: '公司名称',
      companyEmail: '邮箱',
      companyAddress: '地址',
      earnings: '收入',
      deductions: '扣除',
      baseSalary: '基本工资',
      bonuses: '奖金',
      totalBonuses: '总奖金',
      totalEarnings: '总收入',
      deduction: '扣除',
      leaveDays: '休假天数',
      leaveDeduction: '休假扣除',
      totalDeductions: '总扣除',
      netSalary: '实发工资',
      paymentDate: '支付日期',
      signature: '雇主签名',
      employeeSignature: '员工签名',
      footer: '这是计算机生成的工资单'
    },
    ja: {
      title: '給与明細書',
      employeeInfo: '従業員情報',
      companyInfo: '会社情報',
      period: '期間',
      name: '名前',
      position: '役職',
      employeeId: '従業員ID',
      nationalCard: 'マイナンバー',
      insurance: '保険番号',
      phone: '電話',
      email: 'メール',
      address: '住所',
      startDate: '入社日',
      companyName: '会社名',
      companyEmail: 'メール',
      companyAddress: '住所',
      earnings: '支給',
      deductions: '控除',
      baseSalary: '基本給',
      bonuses: '賞与',
      totalBonuses: '賞与合計',
      totalEarnings: '支給合計',
      deduction: '控除',
      leaveDays: '休暇日数',
      leaveDeduction: '休暇控除',
      totalDeductions: '控除合計',
      netSalary: '差引支給額',
      paymentDate: '支払日',
      signature: '雇用主署名',
      employeeSignature: '従業員署名',
      footer: 'これはコンピュータで生成された給与明細書です'
    }
  };

  const t = translations[language] || translations.en;
  const isRTL = language === 'ar';

  // Colors
  const primaryColor = [255, 140, 0]; // Orange
  const darkColor = [0, 0, 0];
  const lightGray = [245, 245, 245];
  const white = [255, 255, 255];

  // Helper function for RTL text
  const addText = (text, x, y, options = {}) => {
    if (isRTL) {
      doc.text(text, 210 - x, y, { align: 'right', ...options });
    } else {
      doc.text(text, x, y, options);
    }
  };

  /* ====== HEADER ====== */
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setFontSize(24);
  doc.setTextColor(...white);
  addText(t.title, 15, 25);

  doc.setFontSize(11);
  addText(`${t.period}: ${month} ${year}`, 15, 33);

  /* ====== COMPANY INFO ====== */
  let yPos = 50;
  doc.setFillColor(...lightGray);
  doc.rect(10, yPos, 90, 45, 'F');

  doc.setFontSize(12);
  doc.setTextColor(...darkColor);
  doc.setFont(undefined, 'bold');
  addText(t.companyInfo, 15, yPos + 8);

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  addText(settings.posName || 'Company Name', 15, yPos + 16);
  addText(settings.email || 'email@company.com', 15, yPos + 23);
  addText(settings.address || 'Company Address', 15, yPos + 30);
  addText(settings.phone || '', 15, yPos + 37);

  /* ====== EMPLOYEE INFO ====== */
  doc.setFillColor(...lightGray);
  doc.rect(110, yPos, 90, 45, 'F');

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  addText(t.employeeInfo, 115, yPos + 8);

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  addText(`${t.name}: ${employee.name}`, 115, yPos + 16);
  addText(`${t.position}: ${employee.position}`, 115, yPos + 23);
  addText(`${t.employeeId}: ${employee.id}`, 115, yPos + 30);
  if (employee.startDate) {
    addText(`${t.startDate}: ${employee.startDate}`, 115, yPos + 37);
  }

  /* ====== EARNINGS SECTION (table-style, gridlines) ====== */
  const earningsX = 10;
  const earningsW = 90;
  let earningsY = 110;

  // header
  doc.setFillColor(...primaryColor);
  doc.rect(earningsX, earningsY, earningsW, 8, 'F');
  doc.setFontSize(11);
  doc.setTextColor(...white);
  doc.setFont(undefined, 'bold');
  addText(t.earnings, earningsX + 5, earningsY + 6);

  // container border
  doc.setDrawColor(220);
  doc.rect(earningsX - 2, earningsY - 6, earningsW + 4, 72);

  earningsY += 12;
  doc.setTextColor(...darkColor);
  doc.setFont(undefined, 'normal');

  // Base Salary row
  addText(t.baseSalary, earningsX + 5, earningsY);
  addText(formatCurrency(employee.salary, settings.currency), earningsX + earningsW - 10, earningsY, { align: 'right' });
  doc.line(earningsX + 2, earningsY + 3, earningsX + earningsW - 2, earningsY + 3);

  // Bonuses rows
  earningsY += 7;
  if (bonuses && bonuses.length > 0) {
    bonuses.forEach((bonus, index) => {
      addText(`${t.bonuses} ${index + 1}: ${bonus.reason || ''}`, earningsX + 5, earningsY);
      addText(formatCurrency(bonus.amount, settings.currency), earningsX + earningsW - 10, earningsY, { align: 'right' });
      doc.line(earningsX + 2, earningsY + 3, earningsX + earningsW - 2, earningsY + 3);
      earningsY += 7;
    });
  }

  const totalBonuses = bonuses.reduce((sum, b) => sum + (b.amount || 0), 0);
  doc.setFont(undefined, 'bold');
  addText(t.totalBonuses, earningsX + 5, earningsY);
  addText(formatCurrency(totalBonuses, settings.currency), earningsX + earningsW - 10, earningsY, { align: 'right' });
  doc.line(earningsX + 2, earningsY + 6, earningsX + earningsW - 2, earningsY + 6);

  earningsY += 8;
  doc.setFillColor(...lightGray);
  doc.rect(earningsX, earningsY - 4, earningsW, 8, 'F');
  addText(t.totalEarnings, earningsX + 5, earningsY + 2);
  addText(formatCurrency(employee.salary + totalBonuses, settings.currency), earningsX + earningsW - 10, earningsY + 2, { align: 'right' });

  /* ====== DEDUCTIONS SECTION (table-style) ====== */
  const dedX = 110;
  const dedW = 90;
  let dedY = 110;

  // header
  doc.setFillColor(...primaryColor);
  doc.rect(dedX, dedY, dedW, 8, 'F');
  doc.setTextColor(...white);
  doc.setFont(undefined, 'bold');
  addText(t.deductions, dedX + 5, dedY + 6);

  // container border
  doc.setDrawColor(220);
  doc.rect(dedX - 2, dedY - 6, dedW + 4, 72);

  dedY += 12;
  doc.setTextColor(...darkColor);
  doc.setFont(undefined, 'normal');

  // Regular deduction
  addText(t.deduction, dedX + 5, dedY);
  addText(formatCurrency(employee.deduction || 0, settings.currency), dedX + dedW - 10, dedY, { align: 'right' });
  doc.line(dedX + 2, dedY + 3, dedX + dedW - 2, dedY + 3);

  // Leave deduction (if applicable)
  dedY += 7;
  const leaveDeduction = leaveDays > 0 ? (employee.salary / 30) * leaveDays : 0;
  if (leaveDays > 0) {
    addText(`${t.leaveDays}: ${leaveDays}`, dedX + 5, dedY);
    addText(formatCurrency(leaveDeduction, settings.currency), dedX + dedW - 10, dedY, { align: 'right' });
    doc.line(dedX + 2, dedY + 3, dedX + dedW - 2, dedY + 3);
    dedY += 7;
  }

  const totalDeductions = (employee.deduction || 0) + leaveDeduction;
  doc.setFillColor(...lightGray);
  doc.rect(dedX, dedY - 4, dedW, 8, 'F');
  doc.setFont(undefined, 'bold');
  addText(t.totalDeductions, dedX + 5, dedY + 2);
  addText(formatCurrency(totalDeductions, settings.currency), dedX + dedW - 10, dedY + 2, { align: 'right' });

  /* ====== NET SALARY ====== */
  yPos += 20;
  const netSalary = employee.salary + totalBonuses - totalDeductions;

  doc.setFillColor(...primaryColor);
  doc.rect(10, yPos, 190, 15, 'F');

  doc.setFontSize(14);
  doc.setTextColor(...white);
  doc.setFont(undefined, 'bold');
  addText(t.netSalary, 15, yPos + 10);
  addText(formatCurrency(netSalary, settings.currency), 190, yPos + 10, { align: 'right' });

  /* ====== ADDITIONAL EMPLOYEE INFO ====== */
  yPos += 25;
  doc.setFontSize(10);
  doc.setTextColor(...darkColor);
  doc.setFont(undefined, 'normal');

  if (employee.nationalCard) {
    addText(`${t.nationalCard}: ${employee.nationalCard}`, 15, yPos);
    yPos += 6;
  }
  if (employee.insurance) {
    addText(`${t.insurance}: ${employee.insurance}`, 15, yPos);
    yPos += 6;
  }
  if (employee.phone) {
    addText(`${t.phone}: ${employee.phone}`, 15, yPos);
    yPos += 6;
  }
  if (employee.email) {
    addText(`${t.email}: ${employee.email}`, 15, yPos);
    yPos += 6;
  }

  /* ====== SIGNATURES ====== */
  yPos = 240;
  doc.setFontSize(10);
  addText(t.signature, 20, yPos);
  doc.rect(15, yPos + 3, 60, 25);

  addText(t.employeeSignature, 130, yPos);
  doc.rect(125, yPos + 3, 60, 25);

  /* ====== FOOTER ====== */
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const paymentDate = new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : language);
  addText(`${t.paymentDate}: ${paymentDate}`, 15, 280);
  doc.text(t.footer, 105, 287, { align: 'center' });

  /* ====== SAVE ====== */
  const fileName = `payslip_${employee.name.replace(/\s+/g, '_')}_${month}_${year}.pdf`;
  doc.save(fileName);
}

// Helper function for currency formatting
function formatCurrency(amount, currency = 'USD') {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    MAD: 'DH',
    DZD: 'DA',
    SAR: 'ر.س',
    AED: 'د.إ',
    TND: 'د.ت'
  };

  const symbol = symbols[currency] || currency;
  const numValue = parseFloat(amount || 0);
  
  // Format number with 2 decimals, using space as thousand separator
  let formatted = numValue.toFixed(2);
  const parts = formatted.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  formatted = parts.join('.');
  
  return formatted + ' ' + symbol;
}

// Make function available globally for React components
window.generatePayslip = generatePayslip;
