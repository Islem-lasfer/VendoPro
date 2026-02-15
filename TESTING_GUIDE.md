# Quick Start Guide - Employee Management Features

## Testing the New Features

### 1. Start the Application
```bash
npm run dev
```

### 2. Navigate to Employees Page
- Click on "Employees" in the sidebar
- You should see the existing employee management interface

### 3. Add a New Employee with Start Date
1. Click "Add Employee" button
2. Fill in the form:
   - Name: John Doe
   - Position: Sales Manager
   - Salary: 5000
   - **Start Date**: Select a date (e.g., 6 months ago)
   - Phone, Email, Address (optional)
3. Click Save
4. Notice the employee appears in the list

### 4. View Employee Details
1. Click the 👁️ (eye) icon next to an employee
2. A detailed modal opens showing:
   - Employee information
   - Leave Management section
   - Bonus Management section
   - Payslip Generation button

### 5. Add Leave
1. In the employee details modal, find "Leave Management"
2. Click "Add Leave" button
3. Fill in the form:
   - Leave Type: Annual Leave
   - Start Date: Select a date
   - End Date: Select a later date
   - Days: Auto-calculated
   - Reason: "Family vacation" (optional)
4. Click Save
5. The leave record appears in the table below

### 6. Add Bonus
1. In the employee details modal, find "Bonus Management"
2. Click "Add Bonus" button
3. Fill in the form:
   - Amount: 500
   - Reason: "Performance bonus for Q1"
   - Date: Select date
4. Click Save
5. The bonus appears in the table with total updated

### 7. Generate Payslip
1. In the employee details modal, click "Generate Payslip"
2. A modal opens to select month and year
3. Select:
   - Month: Current month or any month
   - Year: 2024 or 2025
4. Click "Generate Payslip"
5. A PDF downloads automatically with:
   - Employee details
   - Company information (from Settings)
   - Salary breakdown
   - Bonuses from that month
   - Deductions
   - Leave days taken
   - Net salary
   - Professional formatting in your selected language

### 8. Test Different Languages
1. Go to Settings
2. Change language to French, Arabic, Spanish, etc.
3. Return to Employees page
4. Generate a payslip
5. Notice the PDF is in the selected language
6. For Arabic, the layout is RTL (right-to-left)

### 9. Leave Calculation Verification
- The system automatically calculates:
  - Accrued Leave: 2 days per month since start date
  - Used Leave: Sum of all approved leave days
  - Available Leave: Accrued - Used

### 10. Delete Records
- Click 🗑️ icon on any leave or bonus record
- Confirm deletion
- Record is removed from the database

## Expected Behavior

### Leave Management
✅ Auto-calculates days between start and end dates
✅ Shows accrued leave based on start date
✅ Tracks used leave from approved records
✅ Supports multiple leave types
✅ Stores all leave history

### Bonus Management
✅ Tracks all bonuses with reasons and dates
✅ Calculates total bonuses
✅ Filters bonuses by month for payslips
✅ Shows in payslip PDF

### Payslip Generation
✅ Includes only bonuses from selected month
✅ Calculates leave days taken in that month
✅ Shows company information from Settings
✅ Professional PDF format
✅ Downloads with employee name in filename
✅ All 10 languages supported
✅ RTL support for Arabic

## Database Verification

To verify data is being saved:
```bash
# Open the database file location
# Check tables: employees, employee_leave, employee_bonuses
```

The data should persist between app restarts.

## Troubleshooting

### Payslip not generating?
- Check console for errors
- Ensure jsPDF is loaded
- Verify employee has required fields
- Check Settings has company name

### Leave days not calculating?
- Verify start date and end date are filled
- Check date format is correct
- Ensure dates are in chronological order

### Translations not working?
- Verify language is set in Settings
- Check i18n.js has all keys
- Restart app after language change

### Database errors?
- Check electron/database/db.js
- Verify schema migrations ran
- Check main.js IPC handlers

## Features Summary

✅ Complete leave management system
✅ Bonus tracking and history
✅ Professional payslip generation
✅ 10 languages fully supported
✅ RTL support for Arabic
✅ Automatic leave accrual calculation
✅ Monthly payslip filtering
✅ Responsive design
✅ Persistent database storage
✅ Professional PDF formatting

Enjoy your enhanced employee management system! 🎉
