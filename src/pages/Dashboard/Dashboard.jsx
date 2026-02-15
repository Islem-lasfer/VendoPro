import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Line } from 'react-chartjs-2';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/currency';
import { getAllEmployees, getAllProducts, getAllInvoices } from '../../utils/database';
import './Dashboard.css';

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [chartKey, setChartKey] = React.useState(0);
  const [stats, setStats] = React.useState({
    employees: 0,
    todaySales: 0,
    products: 0,
    monthlyProfit: 0,
    lowStockItems: 0,
    outOfStock: 0,
    avgOrderValue: 0,
    totalStockValue: 0
  });
  const [recentSales, setRecentSales] = React.useState([]);
  const [topProducts, setTopProducts] = React.useState([]);
  const [todayChartData, setTodayChartData] = React.useState({
    labels: [],
    data: []
  });

  // Calculate stats from database
  useEffect(() => {
    const calculateStats = async () => {
      // Get data from database
      const employeesResult = await getAllEmployees();
      const employees = employeesResult.success ? employeesResult.data : [];
      
      const productsResult = await getAllProducts();
      const products = productsResult.success ? productsResult.data : [];
      
      const invoicesResult = await getAllInvoices();
      const invoices = invoicesResult.success ? invoicesResult.data : [];
      
      // Calculate today's sales
      const today = new Date().toDateString();
      const todayInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.date).toDateString();
        return invDate === today;
      });
      const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
      
      // Calculate monthly net profit
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
      });
      
      // Calculate revenue
      const monthlyRevenue = monthlyInvoices.reduce((sum, inv) => sum + inv.total, 0);
      
      // Calculate COGS
      let monthlyCOGS = 0;
      monthlyInvoices.forEach(invoice => {
        if (invoice.items) {
          invoice.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (product && product.purchasePrice) {
              monthlyCOGS += product.purchasePrice * item.quantity;
            }
          });
        }
      });
      
      // Calculate labor costs
      const monthlyLaborCost = employees.reduce((sum, emp) => {
        const deduction = (emp.absences || 0) * 50;
        const netSalary = emp.salary - deduction;
        return sum + netSalary;
      }, 0);
      
      // Calculate net profit
      const monthlyProfit = monthlyRevenue - monthlyCOGS - monthlyLaborCost;
      
      // Get recent sales (last 5 invoices)
      const recent = [...invoices]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
        .map(inv => ({
          id: inv.invoiceNumber,
          time: new Date(inv.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          amount: inv.total,
          items: inv.items ? inv.items.length : 0
        }));
      
      // Calculate top products
      const productSales = {};
      invoices.forEach(inv => {
        if (inv.items) {
          inv.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (product) {
              if (!productSales[product.id]) {
                productSales[product.id] = {
                  name: product.name,
                  sales: 0,
                  revenue: 0
                };
              }
              productSales[product.id].sales += item.quantity;
              productSales[product.id].revenue += item.price * item.quantity;
            }
          });
        }
      });
      
      const topProds = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      
      // Generate today's hourly chart data (24 hours)
      const hourlyStats = {};
      const hours = [];
      for (let i = 0; i < 24; i++) {
        const hour = i === 0 ? '12AM' : i < 12 ? `${i}AM` : i === 12 ? '12PM' : `${i - 12}PM`;
        hours.push(hour);
        hourlyStats[hour] = 0;
      }
      
      todayInvoices.forEach(inv => {
        const hour = new Date(inv.date).getHours();
        const hourLabel = hour === 0 ? '12AM' : hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`;
        
        if (hourlyStats[hourLabel] !== undefined) {
          hourlyStats[hourLabel] += inv.total;
        }
      });
      
      // Cumulative data for chart
      let cumulative = 0;
      const cumulativeData = hours.map(hour => {
        cumulative += hourlyStats[hour];
        return cumulative;
      });
      
      setTodayChartData({
        labels: hours,
        data: cumulativeData
      });
      setRecentSales(recent);
      setTopProducts(topProds);
      
      // Helper to get product total quantity (consider per-location quantities if present)
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

      // Calculate low stock and out of stock items
      // Low stock threshold: items with quantity between 1-10 (unified across all pages)
      const lowStockItems = products.filter(p => {
        const qty = getTotalQty(p);
        return qty > 0 && qty <= 10;
      }).length;
      const outOfStock = products.filter(p => {
        const qty = getTotalQty(p);
        return qty === 0;
      }).length;
      
      // Calculate average order value for today
      const avgOrderValue = todayInvoices.length > 0 
        ? todaySales / todayInvoices.length 
        : 0;
      
      // Calculate total stock value
      const totalStockValue = products.reduce((sum, p) => {
        const price = parseFloat(p.purchasePrice || p.price) || 0;
        const quantity = getTotalQty(p);
        return sum + (price * quantity);
      }, 0);
      
      setStats({
        employees: employees.length,
        todaySales,
        products: products.length,
        monthlyProfit,
        lowStockItems,
        outOfStock,
        avgOrderValue,
        totalStockValue
      });
    };
    
    calculateStats();
  }, []);

  // Force re-render when theme changes
  useEffect(() => {
    setChartKey(prev => prev + 1);
  }, [settings.theme]);

  // Get theme colors from CSS variables
  const getThemeColors = () => {
    const style = getComputedStyle(document.documentElement);
    return {
      text: style.getPropertyValue('--text-primary').trim() || '#ffffff',
      grid: style.getPropertyValue('--border-color').trim() || '#1a1a1a'
    };
  };

  const themeColors = getThemeColors();

  const todayChart = {
    labels: todayChartData.labels,
    datasets: [
      {
        label: 'Sales',
        data: todayChartData.data,
        backgroundColor: 'rgba(255, 102, 0, 0.1)',
        borderColor: '#ff6600',
        borderWidth: 3,
        fill: true,
        tension: 0.4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        ticks: {
          color: themeColors.text,
          callback: function(value) {
            return formatCurrency(value, settings.currency);
          }
        },
        grid: {
          color: themeColors.grid
        }
      },
      x: {
        ticks: {
          color: themeColors.text
        },
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1 className="page-title">{t('dashboard.title')}</h1>
        <div className="dashboard-date">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="dashboard-stats">
        <div className="dashboard-stat-card">
          <div className="stat-icon-large">👥</div>
          <div className="stat-details">
            <h3 className="stat-title">{t('dashboard.totalEmployees')}</h3>
            <p className="stat-number">{stats.employees}</p>
          </div>
        </div>
        <div className="dashboard-stat-card">
          <div className="stat-icon-large">💰</div>
          <div className="stat-details">
            <h3 className="stat-title">{t('dashboard.todaySales')}</h3>
            <p className="stat-number">{formatCurrency(stats.todaySales, settings.currency)}</p>
          </div>
        </div>
        <div className="dashboard-stat-card">
          <div className="stat-icon-large">📦</div>
          <div className="stat-details">
            <h3 className="stat-title">{t('dashboard.totalProducts')}</h3>
            <p className="stat-number">{stats.products}</p>
          </div>
        </div>
        <div className="dashboard-stat-card">
          <div className="stat-icon-large">📈</div>
          <div className="stat-details">
            <h3 className="stat-title">{t('dashboard.monthlyNetProfit')}</h3>
            <p className="stat-number">{formatCurrency(stats.monthlyProfit, settings.currency)}</p>
          </div>
        </div>
        <div className="dashboard-stat-card">
          <div className="stat-icon-large">⚠️</div>
          <div className="stat-details">
            <h3 className="stat-title">{t('dashboard.stockAlerts')}</h3>
            <p className="stat-number">{stats.lowStockItems}</p>
            <p style={{fontSize: '12px', color: '#ff6600', marginTop: '5px'}}>{stats.outOfStock} {t('dashboard.outOfStock')}</p>
          </div>
        </div>
        <div className="dashboard-stat-card">
          <div className="stat-icon-large">💎</div>
          <div className="stat-details">
            <h3 className="stat-title">{t('dashboard.stockValue')}</h3>
            <p className="stat-number">{formatCurrency(stats.totalStockValue, settings.currency)}</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-content">
        {/* Today's Sales Chart */}
        <div className="dashboard-card large-card">
          <h3 className="card-title">{t('dashboard.todaysSalesTrend')}</h3>
          <div className="chart-container">
            <Line key={chartKey} data={todayChart} options={chartOptions} />
          </div>
        </div>

        {/* Recent Sales */}
        <div className="dashboard-card">
          <h3 className="card-title">{t('dashboard.recentSales')}</h3>
          <div className="recent-sales-list">
            {recentSales.map((sale) => (
              <div key={sale.id} className="recent-sale-item">
                <div className="sale-time">{sale.time}</div>
                <div className="sale-items">{sale.items} {t('dashboard.items')}</div>
                <div className="sale-amount">{formatCurrency(sale.amount, settings.currency)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="dashboard-card">
          <h3 className="card-title">{t('dashboard.topProducts')}</h3>
          <div className="top-products-list">
            {topProducts.map((product, index) => (
              <div key={index} className="top-product-item">
                <div className="product-rank">{index + 1}</div>
                <div className="product-info">
                  <p className="product-name-dash">{product.name}</p>
                  <p className="product-sales">{product.sales} {t('dashboard.sales')}</p>
                </div>
                <div className="product-revenue">{formatCurrency(product.revenue, settings.currency)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
