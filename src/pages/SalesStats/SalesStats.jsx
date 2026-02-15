import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext';
import { getAllInvoices, getAllProducts, getAllEmployees, getAllSupplierInvoices } from '../../utils/database';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Line, Pie, Doughnut, Radar, PolarArea } from 'react-chartjs-2';
import './SalesStats.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend
);

const SalesStats = () => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [period, setPeriod] = useState('monthly');
  const [chartKey, setChartKey] = useState(0);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    netProfit: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    totalProducts: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    totalStockValue: 0,
    profitMargin: 0,
    inventoryTurnover: 0,
    totalClientDebt: 0,
    clientsWithDebt: 0,
    totalReturns: 0,
    totalReturnValue: 0,
    returnRate: 0
  });
  const [chartData, setChartData] = useState({
    daily: { labels: [], revenue: [] },
    monthly: { labels: [], revenue: [], profit: [] },
    yearly: { labels: [], revenue: [], profit: [] },
    category: { labels: [], data: [] },
    paymentMethods: { labels: [], data: [] },
    topProducts: { labels: [], data: [] },
    lowStock: { labels: [], data: [] },
    profitMargins: { labels: [], data: [] },
    stockMovement: { labels: [], inbound: [], outbound: [] },
    yearComparison: { labels: [], currentYear: [], lastYear: [] }
  });

  // Calculate net profit from invoices
  useEffect(() => {
    const normalizeNumber = (v) => {
      if (v === null || typeof v === 'undefined') return 0;
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const cleaned = v.replace(/[,;\s]/g, '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      }
      return Number(v) || 0;
    };

    // Helper to get a product's total quantity (considering per-location quantities if present)
    const getTotalQty = (p) => {
      try {
        if (p && p.locationQuantities && typeof p.locationQuantities === 'object') {
          return Object.values(p.locationQuantities).reduce((s, obj) => s + (parseFloat(obj.quantity) || 0), 0);
        }
        return parseFloat(p.quantity || p.stock) || 0;
      } catch (e) {
        return parseFloat(p.quantity || p.stock) || 0;
      }
    };

    const calculateStats = async () => {
      // Get invoices from database
      const invoicesResult = await getAllInvoices();
      const invoices = invoicesResult.success ? invoicesResult.data : [];
      
      // Get products from database
      const productsResult = await getAllProducts();
      const products = productsResult.success ? productsResult.data : [];
      
      // Get employees from database
      const employeesResult = await getAllEmployees();
      const employees = employeesResult.success ? employeesResult.data : [];
      
      // Get supplier invoices from database
      const supplierInvoicesResult = await getAllSupplierInvoices();
      const supplierInvoicesRaw = supplierInvoicesResult.success ? supplierInvoicesResult.data : [];
      // Normalize supplier invoices and compute reliable debt
      const supplierInvoices = supplierInvoicesRaw.map(inv => ({
        ...inv,
        total: normalizeNumber(inv.total),
        paid: normalizeNumber(inv.paid),
        debt: (typeof inv.debt !== 'undefined') ? normalizeNumber(inv.debt) : Math.max(0, +(normalizeNumber(inv.total) - normalizeNumber(inv.paid)).toFixed(2))
      }));
      
      // Get product returns from localStorage
      const productReturns = JSON.parse(localStorage.getItem('productReturns') || '[]');
      
      // Calculate total revenue from invoices
      const grossRevenue = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
      
      // Calculate total return value
      const totalReturnValue = productReturns.reduce((sum, returnRecord) => sum + returnRecord.refund, 0);
      
      // Calculate net revenue (revenue - returns)
      const totalRevenue = grossRevenue - totalReturnValue;
      
      // Calculate return rate
      const returnRate = grossRevenue > 0 ? (totalReturnValue / grossRevenue) * 100 : 0;
      
      // Calculate cost of goods sold (COGS)
      let totalCOGS = 0;
      invoices.forEach(invoice => {
        if (invoice.items) {
          invoice.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (product && product.purchasePrice) {
              totalCOGS += product.purchasePrice * item.quantity;
            }
          });
        }
      });
      
      // Calculate monthly labor costs
      const monthlyLaborCost = employees.reduce((sum, emp) => {
        const netSalary = emp.salary - (emp.deduction || 0);
        return sum + netSalary;
      }, 0);
      
      // Calculate supplier invoice debts (unpaid amounts)
      const totalSupplierDebt = supplierInvoices.reduce((sum, inv) => {
        const debt = Math.max(0, +( (typeof inv.debt !== 'undefined' ? inv.debt : (inv.total - (inv.paid || 0))) ));
        return sum + debt;
      }, 0);

      console.debug('Supplier invoices for stats:', supplierInvoices.map(i => ({ id: i.id, total: i.total, paid: i.paid, debt: i.debt })));
      console.debug('Computed totalSupplierDebt:', totalSupplierDebt);
      
      // Calculate client debts from invoices (tickets with debt > 0)
      const clientDebtData = {};
      invoices.forEach(inv => {
        const debt = inv.debt || 0;
        if (debt > 0 && inv.type === 'ticket') {
          const clientName = inv.customerName || inv.clientName || 'Unknown Client';
          if (!clientDebtData[clientName]) {
            clientDebtData[clientName] = 0;
          }
          clientDebtData[clientName] += debt;
        }
      });
      const totalClientDebt = Object.values(clientDebtData).reduce((sum, debt) => sum + debt, 0);
      const clientsWithDebt = Object.keys(clientDebtData).length;
      
      // Calculate net profit (revenue - COGS - labor costs - supplier debts)
      const netProfit = totalRevenue - totalCOGS - monthlyLaborCost - totalSupplierDebt;
      
      // Generate chart data from invoices
      // Daily data - last 7 days
      const dailyStats = {};
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toDateString();
        last7Days.push(dateStr);
        dailyStats[dateStr] = 0;
      }
      
      invoices.forEach(inv => {
        const dateStr = new Date(inv.date).toDateString();
        if (dailyStats[dateStr] !== undefined) {
          dailyStats[dateStr] += inv.total;
        }
      });
      
      const dailyLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const dailyRevenue = last7Days.map(dateStr => dailyStats[dateStr]);
      
      // Monthly data - last 12 months
      const monthlyStats = { revenue: {}, cogs: {} };
      const last12Months = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        last12Months.push(monthKey);
        monthlyStats.revenue[monthKey] = 0;
        monthlyStats.cogs[monthKey] = 0;
      }
      
      invoices.forEach(inv => {
        const date = new Date(inv.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (monthlyStats.revenue[monthKey] !== undefined) {
          monthlyStats.revenue[monthKey] += inv.total;
          
          // Calculate COGS for this invoice
          if (inv.items) {
            inv.items.forEach(item => {
              const product = products.find(p => p.id === item.productId);
              if (product && product.purchasePrice) {
                monthlyStats.cogs[monthKey] += product.purchasePrice * item.quantity;
              }
            });
          }
        }
      });
      
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyLabels = last12Months.map(key => {
        const [year, month] = key.split('-');
        return monthNames[parseInt(month)];
      });
      const monthlyRevenue = last12Months.map(key => monthlyStats.revenue[key]);
      const monthlyProfit = last12Months.map(key => {
        const revenue = monthlyStats.revenue[key];
        if (revenue === 0) return 0; // No profit/loss if no sales
        return revenue - monthlyStats.cogs[key] - (monthlyLaborCost / 12);
      });
      
      // Yearly data - last 5 years
      const yearlyStats = { revenue: {}, cogs: {} };
      const last5Years = [];
      for (let i = 4; i >= 0; i--) {
        const year = new Date().getFullYear() - i;
        last5Years.push(year);
        yearlyStats.revenue[year] = 0;
        yearlyStats.cogs[year] = 0;
      }
      
      invoices.forEach(inv => {
        const year = new Date(inv.date).getFullYear();
        if (yearlyStats.revenue[year] !== undefined) {
          yearlyStats.revenue[year] += inv.total;
          
          // Calculate COGS for this invoice
          if (inv.items) {
            inv.items.forEach(item => {
              const product = products.find(p => p.id === item.productId);
              if (product && product.purchasePrice) {
                yearlyStats.cogs[year] += product.purchasePrice * item.quantity;
              }
            });
          }
        }
      });
      
      const yearlyLabels = last5Years.map(y => y.toString());
      const yearlyRevenue = last5Years.map(y => yearlyStats.revenue[y]);
      const yearlyProfit = last5Years.map(y => {
        const revenue = yearlyStats.revenue[y];
        if (revenue === 0) return 0; // No profit/loss if no sales
        return revenue - yearlyStats.cogs[y] - (monthlyLaborCost * 12);
      });
      
      // Calculate sales by category from products, showing price type if available
      const categoryStats = {};
      const categoryPriceType = {};
      invoices.forEach(inv => {
        if (inv.items) {
          inv.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (product && product.category) {
              // Determine price type label
              let priceTypeLabel = '';
              if (product.detailPrice && item.price === product.detailPrice) priceTypeLabel = t('products.detailPrice');
              else if (product.wholesalePrice && item.price === product.wholesalePrice) priceTypeLabel = t('products.wholesalePrice');
              // Compose label for grouping (category only)
              const groupKey = product.category;
              if (!categoryStats[groupKey]) {
                categoryStats[groupKey] = { total: 0, priceTypes: {} };
              }
              categoryStats[groupKey].total += item.price * item.quantity;
              if (priceTypeLabel) {
                if (!categoryStats[groupKey].priceTypes[priceTypeLabel]) {
                  categoryStats[groupKey].priceTypes[priceTypeLabel] = 0;
                }
                categoryStats[groupKey].priceTypes[priceTypeLabel] += item.price * item.quantity;
              }
            }
          });
        }
      });
      // Build labels: 'Category: 1000 DA (Detail Price)'
      const categoryLabels = [];
      const categoryValues = [];
      Object.entries(categoryStats).forEach(([cat, data]) => {
        if (Object.keys(data.priceTypes).length > 0) {
          Object.entries(data.priceTypes).forEach(([ptype, val]) => {
            categoryLabels.push(`${cat}: ${formatCurrency(val)} (${ptype})`);
            categoryValues.push(val);
          });
        } else {
          categoryLabels.push(`${cat}: ${formatCurrency(data.total)}`);
          categoryValues.push(data.total);
        }
      });
      
      // Calculate payment methods breakdown
      const paymentStats = {};
      invoices.forEach(inv => {
        const method = inv.paymentMethod || 'Cash';
        if (!paymentStats[method]) paymentStats[method] = 0;
        paymentStats[method] += inv.total;
      });
      const paymentLabels = Object.keys(paymentStats);
      const paymentValues = Object.values(paymentStats);
      
      // Calculate top selling products by revenue
      const productRevenue = {};
      invoices.forEach(inv => {
        if (inv.items) {
          inv.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (product) {
              if (!productRevenue[product.name]) productRevenue[product.name] = 0;
              productRevenue[product.name] += item.price * item.quantity;
            }
          });
        }
      });
      const topProductsLabels = Object.keys(productRevenue)
        .sort((a, b) => productRevenue[b] - productRevenue[a])
        .slice(0, 10);
      const topProductsData = topProductsLabels.map(name => productRevenue[name]);
      
      // Calculate profit margins by product
      const productProfits = {};
      invoices.forEach(inv => {
        if (inv.items) {
          inv.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (product) {
              const revenue = item.price * item.quantity;
              // Use purchasePrice if available, otherwise estimate at 60% of sale price
              const purchasePrice = parseFloat(product.purchasePrice) || (item.price * 0.6);
              const cost = purchasePrice * item.quantity;
              const profit = revenue - cost;
              if (!productProfits[product.name]) {
                productProfits[product.name] = { revenue: 0, profit: 0 };
              }
              productProfits[product.name].revenue += revenue;
              productProfits[product.name].profit += profit;
            }
          });
        }
      });
      const marginLabels = Object.keys(productProfits)
        .filter(name => productProfits[name].revenue > 0)
        .sort((a, b) => {
          const marginA = (productProfits[a].profit / productProfits[a].revenue) * 100;
          const marginB = (productProfits[b].profit / productProfits[b].revenue) * 100;
          return marginB - marginA;
        })
        .slice(0, 10);
      const marginData = marginLabels.map(name => {
        const margin = (productProfits[name].profit / productProfits[name].revenue) * 100;
        return Math.max(0, Math.min(100, margin)); // Clamp between 0-100%
      });
      
      // Calculate low stock and out of stock items
      // Low stock threshold: items with quantity between 1-10 (unified across all pages)
      const lowStockItems = products.filter(p => {
        const qty = getTotalQty(p);
        return qty > 0 && qty <= 10;
      });
      const outOfStockItems = products.filter(p => {
        const qty = getTotalQty(p);
        return qty === 0;
      });
      const lowStockLabels = lowStockItems.map(p => p.name);
      const lowStockData = lowStockItems.map(p => getTotalQty(p));
      
      // Calculate total stock value
      const totalStockValue = products.reduce((sum, p) => {
        const price = parseFloat(p.purchasePrice || p.price) || 0;
        const quantity = getTotalQty(p);
        return sum + (price * quantity);
      }, 0);
      
      // Calculate inventory turnover (COGS / Average Inventory)
      const avgInventoryValue = totalStockValue; // Simplified
      const inventoryTurnover = avgInventoryValue > 0 ? totalCOGS / avgInventoryValue : 0;
      
      // Calculate stock movement (last 12 months)
      const stockMovementStats = { inbound: {}, outbound: {} };
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        stockMovementStats.inbound[monthKey] = 0;
        stockMovementStats.outbound[monthKey] = 0;
      }
      
      // Outbound from sales
      invoices.forEach(inv => {
        const date = new Date(inv.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (stockMovementStats.outbound[monthKey] !== undefined && inv.items) {
          const totalQty = inv.items.reduce((sum, item) => sum + item.quantity, 0);
          stockMovementStats.outbound[monthKey] += totalQty;
        }
      });
      
      // Inbound from supplier invoices (if they have product info)
      supplierInvoices.forEach(inv => {
        const date = new Date(inv.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (stockMovementStats.inbound[monthKey] !== undefined && inv.items) {
          const totalQty = inv.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
          stockMovementStats.inbound[monthKey] += totalQty;
        }
      });
      
      const movementLabels = Object.keys(stockMovementStats.inbound).map(key => {
        const [year, month] = key.split('-');
        return monthNames[parseInt(month)];
      });
      const inboundData = Object.values(stockMovementStats.inbound);
      const outboundData = Object.values(stockMovementStats.outbound);
      
      // Year-over-year comparison (current year vs last year)
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      const yearComparisonStats = { current: {}, last: {} };
      
      for (let i = 0; i < 12; i++) {
        yearComparisonStats.current[i] = 0;
        yearComparisonStats.last[i] = 0;
      }
      
      invoices.forEach(inv => {
        const date = new Date(inv.date);
        const year = date.getFullYear();
        const month = date.getMonth();
        
        if (year === currentYear) {
          yearComparisonStats.current[month] += inv.total;
        } else if (year === lastYear) {
          yearComparisonStats.last[month] += inv.total;
        }
      });
      
      const comparisonLabels = monthNames;
      const currentYearData = Object.values(yearComparisonStats.current);
      const lastYearData = Object.values(yearComparisonStats.last);
      
      // Calculate average order value
      const avgOrderValue = invoices.length > 0 ? totalRevenue / invoices.length : 0;
      
      // Calculate overall profit margin
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      
      setChartData({
        daily: { labels: dailyLabels, revenue: dailyRevenue },
        monthly: { labels: monthlyLabels, revenue: monthlyRevenue, profit: monthlyProfit },
        yearly: { labels: yearlyLabels, revenue: yearlyRevenue, profit: yearlyProfit },
        category: { labels: categoryLabels, data: categoryValues },
        paymentMethods: { labels: paymentLabels, data: paymentValues },
        topProducts: { labels: topProductsLabels, data: topProductsData },
        lowStock: { labels: lowStockLabels, data: lowStockData },
        profitMargins: { labels: marginLabels, data: marginData },
        stockMovement: { labels: movementLabels, inbound: inboundData, outbound: outboundData },
        yearComparison: { labels: comparisonLabels, currentYear: currentYearData, lastYear: lastYearData }
      });
      
      setStats({
        totalRevenue,
        netProfit,
        totalOrders: invoices.length,
        avgOrderValue,
        totalProducts: products.length,
        lowStockItems: lowStockItems.length,
        outOfStockItems: outOfStockItems.length,
        totalStockValue,
        profitMargin,
        inventoryTurnover,
        totalClientDebt,
        clientsWithDebt,
        totalReturns: productReturns.length,
        totalReturnValue,
        returnRate
      });
    };
    
    calculateStats();

    // Listen for supplier invoice updates to refresh stats
    const onSupplierUpdate = () => {
      calculateStats();
    };
    window.addEventListener('supplierInvoices:updated', onSupplierUpdate);
    return () => window.removeEventListener('supplierInvoices:updated', onSupplierUpdate);
  }, []);

  // Force re-render when theme changes
  useEffect(() => {
    setChartKey(prev => prev + 1);
  }, [settings.theme]);

  // Format currency
  const formatCurrency = (amount) => {
    // Use DZD as default, fallback to settings.currency if set
    const currency = settings.currency || 'DZD';
    // Use 'fr-DZ' for Algerian Dinar formatting
    return new Intl.NumberFormat('fr-DZ', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Get theme colors from CSS variables
  const getThemeColors = () => {
    const style = getComputedStyle(document.documentElement);
    return {
      text: style.getPropertyValue('--text-primary').trim() || '#ffffff',
      grid: style.getPropertyValue('--border-color').trim() || '#1a1a1a',
      background: style.getPropertyValue('--card-bg').trim() || '#0f0f0f'
    };
  };

  const themeColors = getThemeColors();

  // Generate chart data from database
  const dailyData = {
    labels: chartData.daily.labels,
    datasets: [
      {
        label: t('sales.revenue'),
        data: chartData.daily.revenue,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(156, 39, 176, 0.8)');
          gradient.addColorStop(1, 'rgba(63, 81, 181, 0.1)');
          return gradient;
        },
        borderColor: '#9c27b0',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#9c27b0',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  };

  const monthlyData = {
    labels: chartData.monthly.labels,
    datasets: [
      {
        label: t('sales.revenue'),
        data: chartData.monthly.revenue,
        backgroundColor: 'rgba(33, 150, 243, 0.8)',
        borderColor: '#2196f3',
        borderWidth: 2
      },
      {
        label: t('sales.profit'),
        data: chartData.monthly.profit,
        backgroundColor: 'rgba(76, 175, 80, 0.8)',
        borderColor: '#4caf50',
        borderWidth: 2
      }
    ]
  };

  const yearlyData = {
    labels: chartData.yearly.labels,
    datasets: [
      {
        label: t('sales.revenue'),
        data: chartData.yearly.revenue,
        backgroundColor: 'rgba(0, 188, 212, 0.8)',
        borderColor: '#00bcd4',
        borderWidth: 2,
        tension: 0.4
      },
      {
        label: t('sales.profit'),
        data: chartData.yearly.profit,
        backgroundColor: 'rgba(0, 150, 136, 0.8)',
        borderColor: '#009688',
        borderWidth: 2,
        tension: 0.4
      }
    ]
  };

  const categoryData = {
    labels: chartData.category.labels.length > 0 ? chartData.category.labels : [t('sales.noData')],
    datasets: [
      {
        data: chartData.category.data.length > 0 ? chartData.category.data : [1],
        backgroundColor: [
          'rgba(244, 67, 54, 0.9)',
          'rgba(233, 30, 99, 0.9)',
          'rgba(156, 39, 176, 0.9)',
          'rgba(103, 58, 183, 0.9)',
          'rgba(63, 81, 181, 0.9)',
          'rgba(33, 150, 243, 0.9)',
          'rgba(3, 169, 244, 0.9)',
          'rgba(0, 188, 212, 0.9)',
          'rgba(0, 150, 136, 0.9)',
          'rgba(76, 175, 80, 0.9)',
          'rgba(139, 195, 74, 0.9)',
          'rgba(205, 220, 57, 0.9)',
          'rgba(255, 235, 59, 0.9)',
          'rgba(255, 193, 7, 0.9)',
          'rgba(255, 152, 0, 0.9)',
          'rgba(255, 87, 34, 0.9)'
        ],
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 15,
        hoverBorderWidth: 4
      }
    ]
  };

  const paymentMethodsData = {
    labels: chartData.paymentMethods.labels.length > 0 ? chartData.paymentMethods.labels : [t('sales.noData')],
    datasets: [
      {
        data: chartData.paymentMethods.data.length > 0 ? chartData.paymentMethods.data : [1],
        backgroundColor: [
          'rgba(76, 175, 80, 0.9)',
          'rgba(33, 150, 243, 0.9)',
          'rgba(156, 39, 176, 0.9)',
          'rgba(255, 193, 7, 0.9)',
          'rgba(244, 67, 54, 0.9)',
          'rgba(255, 152, 0, 0.9)',
          'rgba(0, 188, 212, 0.9)',
          'rgba(233, 30, 99, 0.9)'
        ],
        borderColor: '#fff',
        borderWidth: 3,
        spacing: 2,
        hoverOffset: 12
      }
    ]
  };

  const topProductsData = {
    labels: chartData.topProducts.labels,
    datasets: [
      {
        label: t('sales.revenue'),
        data: chartData.topProducts.data,
        backgroundColor: [
          'rgba(244, 67, 54, 0.9)',
          'rgba(233, 30, 99, 0.9)',
          'rgba(156, 39, 176, 0.9)',
          'rgba(103, 58, 183, 0.9)',
          'rgba(63, 81, 181, 0.9)',
          'rgba(33, 150, 243, 0.9)',
          'rgba(0, 188, 212, 0.9)',
          'rgba(0, 150, 136, 0.9)',
          'rgba(76, 175, 80, 0.9)',
          'rgba(255, 193, 7, 0.9)'
        ],
        borderColor: [
          '#f44336',
          '#e91e63',
          '#9c27b0',
          '#673ab7',
          '#3f51b5',
          '#2196f3',
          '#00bcd4',
          '#009688',
          '#4caf50',
          '#ffc107'
        ],
        borderWidth: 2,
        borderRadius: 8,
        hoverBackgroundColor: 'rgba(255, 102, 0, 1)'
      }
    ]
  };

  const profitMarginsData = {
    labels: chartData.profitMargins.labels.length > 0 ? chartData.profitMargins.labels : [t('sales.noData')],
    datasets: [
      {
        label: 'Profit Margin (%)',
        data: chartData.profitMargins.data.length > 0 ? chartData.profitMargins.data : [0],
        backgroundColor: (context) => {
          if (chartData.profitMargins.data.length === 0) return 'rgba(128, 128, 128, 0.5)';
          const value = context.raw;
          if (value > 50) return 'rgba(76, 175, 80, 0.9)';
          if (value > 30) return 'rgba(255, 193, 7, 0.9)';
          return 'rgba(255, 152, 0, 0.9)';
        },
        borderColor: chartData.profitMargins.data.length > 0 ? '#4caf50' : '#999',
        borderWidth: 2,
        borderRadius: 8,
        pointBackgroundColor: '#4caf50',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }
    ]
  };

  const lowStockData = {
    labels: chartData.lowStock.labels.length > 0 ? chartData.lowStock.labels : ['No Items'],
    datasets: [
      {
        label: 'Stock Level',
        data: chartData.lowStock.data.length > 0 ? chartData.lowStock.data : [0],
        backgroundColor: (context) => {
          const value = context.raw;
          if (value <= 3) return 'rgba(244, 67, 54, 0.9)';
          if (value <= 7) return 'rgba(255, 152, 0, 0.9)';
          return 'rgba(255, 193, 7, 0.9)';
        },
        borderColor: '#f44336',
        borderWidth: 2,
        borderRadius: 6
      }
    ]
  };

  const stockMovementData = {
    labels: chartData.stockMovement.labels,
    datasets: [
      {
        label: 'Inbound (Purchases)',
        data: chartData.stockMovement.inbound,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(76, 175, 80, 0.8)');
          gradient.addColorStop(1, 'rgba(76, 175, 80, 0.1)');
          return gradient;
        },
        borderColor: '#4caf50',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#4caf50',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4
      },
      {
        label: 'Outbound (Sales)',
        data: chartData.stockMovement.outbound,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(244, 67, 54, 0.8)');
          gradient.addColorStop(1, 'rgba(244, 67, 54, 0.1)');
          return gradient;
        },
        borderColor: '#f44336',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#f44336',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4
      }
    ]
  };

  const yearComparisonData = {
    labels: chartData.yearComparison.labels,
    datasets: [
      {
        label: `${new Date().getFullYear()} ${t('sales.revenue')}`,
        data: chartData.yearComparison.currentYear,
        backgroundColor: 'rgba(63, 81, 181, 0.8)',
        borderColor: '#3f51b5',
        borderWidth: 2,
        tension: 0.4
      },
      {
        label: `${new Date().getFullYear() - 1} ${t('sales.revenue')}`,
        data: chartData.yearComparison.lastYear,
        backgroundColor: 'rgba(233, 30, 99, 0.8)',
        borderColor: '#e91e63',
        borderWidth: 2,
        tension: 0.4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: themeColors.text,
          font: {
            size: 13,
            weight: '600'
          },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      title: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#9c27b0',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: themeColors.text,
          font: {
            size: 11
          }
        },
        grid: {
          color: themeColors.grid,
          drawBorder: false
        }
      },
      x: {
        ticks: {
          color: themeColors.text,
          font: {
            size: 11
          }
        },
        grid: {
          display: false
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: themeColors.text,
          font: {
            size: 12,
            weight: '500'
          },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#ff6600',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12
      }
    },
    cutout: '0%'
  };

  const doughnutOptions = {
    ...pieOptions,
    cutout: '65%',
    plugins: {
      ...pieOptions.plugins,
      legend: {
        ...pieOptions.plugins.legend,
        position: 'bottom'
      }
    }
  };

  const getCurrentData = () => {
    switch (period) {
      case 'daily':
        return dailyData;
      case 'monthly':
        return monthlyData;
      case 'yearly':
        return yearlyData;
      default:
        return monthlyData;
    }
  };

  return (
    <div className="sales-stats-page">
      <div className="page-header">
        <h1 className="page-title">{t('sales.title')}</h1>
        <div className="period-selector">
          <button
            className={`period-btn ${period === 'daily' ? 'active' : ''}`}
            onClick={() => setPeriod('daily')}
          >
            {t('sales.daily')}
          </button>
          <button
            className={`period-btn ${period === 'monthly' ? 'active' : ''}`}
            onClick={() => setPeriod('monthly')}
          >
            {t('sales.monthly')}
          </button>
          <button
            className={`period-btn ${period === 'yearly' ? 'active' : ''}`}
            onClick={() => setPeriod('yearly')}
          >
            {t('sales.yearly')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <p className="stat-label">{t('sales.revenue')}</p>
            <h3 className="stat-value">{formatCurrency(stats.totalRevenue)}</h3>
            <p className="stat-change positive">{t('sales.totalRevenue')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <p className="stat-label">{t('sales.net')} {t('sales.profit')}</p>
            <h3 className="stat-value">{formatCurrency(stats.netProfit)}</h3>
            <p className="stat-change positive">{t('sales.afterCogsLabor')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🛍️</div>
          <div className="stat-content">
            <p className="stat-label">{t('sales.orders')}</p>
            <h3 className="stat-value">{stats.totalOrders}</h3>
            <p className="stat-change positive">{t('sales.totalInvoices')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <p className="stat-label">{t('sales.avgOrderValue')}</p>
            <h3 className="stat-value">{formatCurrency(stats.avgOrderValue)}</h3>
            <p className="stat-change positive">{t('sales.perTransaction')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <p className="stat-label">{t('sales.totalProducts')}</p>
            <h3 className="stat-value">{stats.totalProducts}</h3>
            <p className="stat-change positive">{t('sales.inInventory')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <p className="stat-label">{t('sales.lowStockAlert')}</p>
            <h3 className="stat-value">{stats.lowStockItems}</h3>
            <p className="stat-change negative">{stats.outOfStockItems} {t('sales.outOfStock')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💎</div>
          <div className="stat-content">
            <p className="stat-label">{t('sales.stockValue')}</p>
            <h3 className="stat-value">{formatCurrency(stats.totalStockValue)}</h3>
            <p className="stat-change positive">{t('sales.totalStockValue')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <p className="stat-label">{t('sales.profitMarginPercent').replace(' (%)', '')}</p>
            <h3 className="stat-value">{stats.profitMargin.toFixed(1)}%</h3>
            <p className="stat-change positive">{t('sales.net')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <p className="stat-label">{t('sales.inventoryTurnover')}</p>
            <h3 className="stat-value">{stats.inventoryTurnover.toFixed(2)}x</h3>
            <p className="stat-change positive">{t('sales.annualRate')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💳</div>
          <div className="stat-content">
            <p className="stat-label">{t('sales.clientDebt')}</p>
            <h3 className="stat-value" style={{ color: stats.totalClientDebt > 0 ? '#ff6b6b' : '#51cf66' }}>
              {formatCurrency(stats.totalClientDebt)}
            </h3>
            <p className="stat-change" style={{ color: stats.totalClientDebt > 0 ? '#ff6b6b' : '#51cf66' }}>
              {stats.clientsWithDebt} {t('sales.clientsWithDebt')}
            </p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <p className="stat-label">{t('sales.productReturns')}</p>
            <h3 className="stat-value" style={{ color: stats.totalReturns > 0 ? '#ff922b' : '#51cf66' }}>
              {stats.totalReturns}
            </h3>
            <p className="stat-change" style={{ color: stats.totalReturns > 0 ? '#ff922b' : '#51cf66' }}>
              {formatCurrency(stats.totalReturnValue)}
            </p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <p className="stat-label">{t('sales.returnRate')}</p>
            <h3 className="stat-value" style={{ color: stats.returnRate > 5 ? '#ff6b6b' : stats.returnRate > 2 ? '#ff922b' : '#51cf66' }}>
              {stats.returnRate.toFixed(2)}%
            </h3>
            <p className="stat-change" style={{ color: stats.returnRate > 5 ? '#ff6b6b' : '#51cf66' }}>
              {t('sales.ofTotalSales')}
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-container">
        <div className="chart-card large">
          <h3 className="chart-title">
            {period === 'yearly' ? `${t('sales.revenue')} & ${t('sales.profit')} ${t('sales.trends')}` : t('sales.revenueAnalysis')}
          </h3>
          <div className="chart-wrapper">
            {period === 'yearly' ? (
              <Line key={chartKey} data={getCurrentData()} options={chartOptions} />
            ) : (
              <Bar key={chartKey} data={getCurrentData()} options={chartOptions} />
            )}
          </div>
        </div>

        <div className="chart-card small">
          <h3 className="chart-title">{t('sales.salesByCategory')}</h3>
          <div className="chart-wrapper">
            <Doughnut key={chartKey} data={categoryData} options={doughnutOptions} />
          </div>
        </div>

        <div className="chart-card small">
          <h3 className="chart-title">{t('sales.paymentMethodsDistribution')}</h3>
          <div className="chart-wrapper">
            <Pie key={chartKey} data={paymentMethodsData} options={pieOptions} />
          </div>
        </div>

        <div className="chart-card large">
          <h3 className="chart-title">{t('sales.topProductsByRevenue')}</h3>
          <div className="chart-wrapper">
            <Bar 
              key={chartKey} 
              data={topProductsData} 
              options={{
                ...chartOptions,
                indexAxis: 'y',
                scales: {
                  y: {
                    ticks: {
                      color: themeColors.text,
                      font: {
                        size: 11
                      }
                    },
                    grid: {
                      display: false
                    }
                  },
                  x: {
                    beginAtZero: true,
                    ticks: {
                      color: themeColors.text,
                      font: {
                        size: 11
                      }
                    },
                    grid: {
                      color: themeColors.grid,
                      drawBorder: false
                    }
                  }
                }
              }} 
            />
          </div>
        </div>

        <div className="chart-card small">
          <h3 className="chart-title">{t('sales.productProfitMargins')}</h3>
          <div className="chart-wrapper">
            <Radar 
              key={chartKey} 
              data={profitMarginsData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  },
                  tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#ff6600',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12
                  }
                },
                scales: {
                  r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                      color: themeColors.text,
                      backdropColor: 'transparent',
                      font: {
                        size: 10
                      },
                      stepSize: 20
                    },
                    grid: {
                      color: themeColors.grid
                    },
                    pointLabels: {
                      color: themeColors.text,
                      font: {
                        size: 11,
                        weight: '500'
                      }
                    }
                  }
                }
              }} 
            />
          </div>
        </div>

        <div className="chart-card small">
          <h3 className="chart-title">{t('sales.lowStockAlert')}</h3>
          <div className="chart-wrapper">
            <PolarArea 
              key={chartKey} 
              data={lowStockData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      color: themeColors.text,
                      font: {
                        size: 12,
                        weight: '500'
                      },
                      padding: 15,
                      usePointStyle: true,
                      pointStyle: 'circle',
                      boxWidth: 8,
                      boxHeight: 8
                    }
                  },
                  tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#ff6600',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12
                  }
                },
                scales: {
                  r: {
                    ticks: {
                      display: false
                    },
                    grid: {
                      color: themeColors.grid
                    }
                  }
                }
              }} 
            />
          </div>
        </div>

        <div className="chart-card large">
          <h3 className="chart-title">{t('sales.stockMovementTrends')}</h3>
          <div className="chart-wrapper">
            <Line 
              key={chartKey} 
              data={stockMovementData} 
              options={{
                ...chartOptions,
                elements: {
                  line: {
                    tension: 0.4
                  }
                }
              }} 
            />
          </div>
        </div>

        <div className="chart-card large">
          <h3 className="chart-title">{t('sales.yearOverYearComparison')}</h3>
          <div className="chart-wrapper">
            <Line 
              key={chartKey} 
              data={yearComparisonData} 
              options={{
                ...chartOptions,
                elements: {
                  line: {
                    tension: 0.4
                  }
                }
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesStats;
