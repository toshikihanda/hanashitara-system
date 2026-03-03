'use client';

import { useState, useEffect } from 'react';

// ①取得データの型定義
interface ReportData {
    id: string; // GASで生成したUUID
    date: string;
    staff: string;
    customerName: string;
    customerPhone: string;
    services: string;
    totalSales: number;
    staffShare: number;
    isPaid: boolean;
    daysPending: number; // 未入金日数（フロントエンドで計算）
    paymentDate?: string; // 入金日（入金チェックを押した日付）
}

export default function AdminDashboard() {
    const [reports, setReports] = useState<ReportData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorText, setErrorText] = useState('');

    // タブ状態管理
    const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'staff' | 'customers' | 'deposit'>('dashboard');
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [staffSortOption, setStaffSortOption] = useState<'sales_desc' | 'totalSales_desc' | 'name_asc'>('sales_desc');
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [showBlacklistOnly, setShowBlacklistOnly] = useState(false);
    // ボーナス設定状態
    const [bonusThreshold, setBonusThreshold] = useState(5000);
    const [bonusRate, setBonusRate] = useState(14);
    // PDFプレビュー用状態
    const [selectedPdfStaff, setSelectedPdfStaff] = useState<string | null>(null);
    // 前払いデポジット状態と顧客電話番号
    const [deposits, setDeposits] = useState<Record<string, number>>({});
    const [customerPhones, setCustomerPhones] = useState<Record<string, string>>({});
    // スタッフのメアド保持用
    const [staffEmails, setStaffEmails] = useState<Record<string, string>>({});

    type CustomerSortOption = 'deposit' | 'paid_desc' | 'registered_asc' | 'registered_desc' | 'name_asc' | 'number_asc';
    const [customerSortBy, setCustomerSortBy] = useState<CustomerSortOption>('deposit');

    // コピー完了アニメーション表示用
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // ブラックリスト保持用
    const [blacklistedPhones, setBlacklistedPhones] = useState<string[]>([]);

    const currentYearDefault = new Date().getFullYear();
    const currentMonthStrDefault = `${currentYearDefault}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState(currentMonthStrDefault);
    const [showMonthPicker, setShowMonthPicker] = useState(false); // 年月ドロップダウン表示用
    const [trendOffset, setTrendOffset] = useState(0); // グラフスライド用オフセット

    // 履歴モーダル・スタッフ詳細用
    const [depositLogs, setDepositLogs] = useState<any[]>([]);
    const [showHistoryForCustomer, setShowHistoryForCustomer] = useState<string | null>(null);
    const [showStaffDetailFor, setShowStaffDetailFor] = useState<string | null>(null);

    // インライン編集用ステート
    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [editReportData, setEditReportData] = useState<{ customerName: string, customerPhone: string, totalSales: number }>({ customerName: '', customerPhone: '', totalSales: 0 });

    const [editingStaffName, setEditingStaffName] = useState<string | null>(null);
    const [editStaffData, setEditStaffData] = useState<{ password: string, email: string }>({ password: '', email: '' });

    const [editingCustomerName, setEditingCustomerName] = useState<string | null>(null);
    const [editCustomerData, setEditCustomerData] = useState<{ customerName: string, customerPhone: string }>({ customerName: '', customerPhone: '' });
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 顧客追加・チャージ用モーダルステート
    const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
    const [showChargeModal, setShowChargeModal] = useState(false);
    const [chargeTarget, setChargeTarget] = useState<string | null>(null);
    const [newCustomerData, setNewCustomerData] = useState({ name: '', phone: '' });
    const [chargeData, setChargeData] = useState({ amount: '', bonusRate: bonusRate.toString() });

    // スタッフ追加モーダル用ステート
    const [showAddStaffModal, setShowAddStaffModal] = useState(false);
    const [newStaffData, setNewStaffData] = useState({ name: '', password: '', email: '' });

    // トースト通知用ステート
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzopMne7Ga8ZruWAf3xvAP7WQFvQ-Uau09qsmG2K6-Mcs7xfrXXl1Ev4GmLHpOcgTwj/exec';

    // ②初回読み込み時に全データを取得する
    useEffect(() => {
        fetchReports(true);
        fetchBlacklist();
        fetchDeposits();
        fetchStaffList();

        // ボーナス設定の読み込み
        const savedThreshold = localStorage.getItem('depositBonusThreshold');
        const savedRate = localStorage.getItem('depositBonusRate');
        if (savedThreshold) setBonusThreshold(Number(savedThreshold));
        if (savedRate) setBonusRate(Number(savedRate));
    }, []);

    const fetchStaffList = async () => {
        try {
            const res = await fetch(`${GAS_URL}?action=getStaffList`);
            const json = await res.json();
            if (json.success && json.staff) {
                const emails: Record<string, string> = {};
                json.staff.forEach((s: any) => { emails[s.name] = s.email; });
                setStaffEmails(emails);
            }
        } catch (err) {
            console.error('スタッフ取得エラー:', err);
        }
    };

    const fetchDeposits = async () => {
        try {
            const res = await fetch(`${GAS_URL}?action=getDeposits`);
            const json = await res.json();
            if (json.success) {
                setDeposits(json.deposits || {});
                const safePhones: Record<string, string> = {};
                for (const [k, v] of Object.entries(json.phones || {})) {
                    safePhones[k] = String(v).trim();
                }
                setCustomerPhones(safePhones);
            }
        } catch (err) {
            console.error('デポジット取得エラー:', err);
        }
    };

    const fetchDepositLogs = async (retryForCustomer?: string) => {
        try {
            const res = await fetch(`${GAS_URL}?action=getDepositHistory`);
            const json = await res.json();
            if (json.success && json.history) {
                setDepositLogs(json.history);
                if (retryForCustomer) setShowHistoryForCustomer(retryForCustomer);
            }
        } catch (err) {
            console.error('履歴取得エラー:', err);
        }
    };

    const fetchBlacklist = async () => {
        try {
            const res = await fetch(`${GAS_URL}?action=getBlacklistPhones`);
            const json = await res.json();
            if (json.success) {
                const safeBlacklist = (json.phones || []).map((p: any) => String(p).trim());
                setBlacklistedPhones(safeBlacklist);
            }
        } catch (err) {
            console.error('ブラックリスト取得エラー:', err);
        }
    };

    const fetchReports = async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        try {
            // GASの doGet 側を叩く (action=getReports)
            const res = await fetch(`${GAS_URL}?action=getReports`);
            const json = await res.json();

            if (json.success) {
                // 取得した二次元配列をオブジェクト形式に整形＋日数の計算
                const today = new Date();
                const formattedData: ReportData[] = json.data.map((row: any[]) => {
                    // A:ID(0), B:日付(1), C:スタッフ(2), D:顧客電話(3), E:顧客名(4),
                    // F:提供サービス(5), G:総売上(6), H:スタッフ報酬(7), I:入金済(8), J:入金日(9)

                    // 未入金日数の計算
                    let days = 0;
                    const isPaidStatus = row[8] === '入金済' || row[8] === true || row[8] === 'TRUE';
                    if (!isPaidStatus && row[1]) {
                        const reportDate = new Date(row[1]);
                        const diffTime = Math.abs(today.getTime() - reportDate.getTime());
                        days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    }

                    return {
                        id: row[0],
                        date: row[1],
                        staff: String(row[2] || ''),
                        customerPhone: String(row[3] || '').trim(),
                        customerName: String(row[4] || ''),
                        services: String(row[5] || ''),
                        totalSales: Number(row[6]) || 0,
                        staffShare: Number(row[7]) || 0,
                        isPaid: isPaidStatus,
                        daysPending: days,
                        paymentDate: row[9] ? String(row[9]) : undefined
                    };
                });

                // 日付の新しい順に並び替え（降順）
                formattedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setReports(formattedData);
            } else {
                setErrorText('データの取得に失敗しました: ' + json.message);
            }
        } catch (err) {
            console.error(err);
            setErrorText('通信エラーが発生しました。');
        } finally {
            if (showLoader) setIsLoading(false);
        }
    };

    const handleRefreshData = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                fetchReports(false),
                fetchBlacklist(),
                fetchDeposits(),
                fetchStaffList()
            ]);
        } finally {
            setIsRefreshing(false);
        }
    };

    const togglePaidStatus = async (id: string, currentPaid: boolean) => {
        const newPaidStatus = !currentPaid;
        const paymentDate = newPaidStatus ? new Date().toISOString() : undefined;

        // 画面上の見た目を即座に切り替える
        setReports(reports.map(r => r.id === id ? { ...r, isPaid: newPaidStatus, paymentDate } : r));

        try {
            // GASへ通信してスプレッドシートを更新
            await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'updatePaidStatus',
                    id: id,
                    isPaid: newPaidStatus,
                    paymentDate: paymentDate
                }),
            });
        } catch (error) {
            console.error('更新エラー:', error);
            alert('通信エラーが発生しました。元の状態に戻ります。');
            // エラー時は画面を元に戻す
            setReports(reports.map(r => r.id === id ? { ...r, isPaid: currentPaid, paymentDate: undefined } : r));
        }
    };

    const handleAddBlacklist = async (phone: string, name: string) => {
        const reason = window.prompt(`${name}さん (${phone}) をブラックリストに登録する理由を入力してください（イタズラ、未払い等）`);
        if (!reason) return; // キャンセル

        // 即座にUIへ反映
        setBlacklistedPhones(prev => [...prev, phone]);

        try {
            await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'addBlacklist', phone, name, reason }),
            });
            alert('ブラックリストに登録しました。');
        } catch (err) {
            console.error('ブラックリスト登録エラー:', err);
            alert('通信エラーが発生しました。時間を置いて再度お試しください。');
            // エラー時は元に戻す
            setBlacklistedPhones(prev => prev.filter(p => p !== phone));
        }
    };

    // 督促文をクリップボードにコピーする関数
    const handleCopyRemind = (report: ReportData) => {
        const text = `${report.customerName} 様
        
いつもハナシタラ.comをご利用いただき、誠にありがとうございます。
${new Date(report.date).toLocaleDateString('ja-JP')} にご利用いただきました下記サービスにつきまして、現在ご入金の確認がとれておりません。

【ご利用内容】: ${report.services}
【ご請求金額】: ¥${report.totalSales.toLocaleString()}-

お手数をおかけいたしますが、指定の口座までご入金をお願い申し上げます。
行き違いで既にお振込済みの場合は、何卒ご容赦くださいませ。

引き続き、ハナシタラ.comをよろしくお願いいたします。`;

        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(report.id);
            setTimeout(() => setCopiedId(null), 2000); // 2秒後に「コピーしました」の表示を消す
        }).catch(err => {
            console.error('コピー失敗:', err);
            alert('クリップボードへのコピーに失敗しました。');
        });
    };

    // 年月選択: 前月・次月への移動関数
    const handlePrevMonth = () => {
        const date = new Date(selectedMonth + '-01');
        date.setMonth(date.getMonth() - 1);
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(newMonth);
    };

    const handleNextMonth = () => {
        const date = new Date(selectedMonth + '-01');
        date.setMonth(date.getMonth() + 1);
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(newMonth);
    };

    // 年月ピッカーで選択可能な月のリスト生成（過去24ヶ月 + 未来6ヶ月）
    const generateMonthOptions = () => {
        const options = [];
        const now = new Date();
        for (let i = -24; i <= 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            options.push(monthStr);
        }
        return options;
    };

    // サービス名をパースして簡潔に表示（例: 「占い(40分 -> 計算40分)」→「占い 40分」）
    const parseServiceName = (serviceName: string) => {
        const match = serviceName.match(/^(.+?)\((\d+)分/);
        if (match) {
            return `${match[1]} ${match[2]}分`;
        }
        return serviceName;
    };

    // 入金日を「月日」形式にフォーマット（例: 「3月3日」）
    const formatPaymentDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    };

    // トースト通知を表示する関数
    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // ---- フェーズ4: 集計ロジック ----
    const currentYearObj = new Date(selectedMonth + '-01');
    const currentYear = currentYearObj.getFullYear();
    const currentMonthStr = selectedMonth;

    // 1. 年間合計（当年）
    const yearReports = reports.filter(r => new Date(r.date).getFullYear() === currentYear);
    const totalYearSales = yearReports.reduce((sum, r) => sum + r.totalSales, 0);
    const totalYearProfit = yearReports.reduce((sum, r) => sum + (r.totalSales - r.staffShare), 0);

    // 1.5. 本日の売上（当日）
    const todayStr = new Date().toLocaleDateString('ja-JP');
    const todayReports = reports.filter(r => new Date(r.date).toLocaleDateString('ja-JP') === todayStr);
    const totalTodaySales = todayReports.reduce((sum, r) => sum + r.totalSales, 0);

    // 2. 今月分合計
    const monthReports = reports.filter(r => {
        const d = new Date(r.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === currentMonthStr;
    });
    const totalMonthSales = monthReports.reduce((sum, r) => sum + r.totalSales, 0);
    const totalMonthProfit = monthReports.reduce((sum, r) => sum + (r.totalSales - r.staffShare), 0);

    // 3. 全ての未入金額・件数
    const unpaidReports = reports.filter(r => !r.isPaid);
    const totalUnpaid = unpaidReports.reduce((sum, r) => sum + r.totalSales, 0);
    const unpaidCount = unpaidReports.length;

    // 4. スタッフ別集計（今月 ＋ 累計）
    const staffStatsMap = new Map<string, { sales: number, share: number, totalSales: number, totalShare: number }>();

    // すべての登録済みスタッフを初期化（売上0でも表示させるため）
    Object.keys(staffEmails).forEach(name => {
        staffStatsMap.set(name, { sales: 0, share: 0, totalSales: 0, totalShare: 0 });
    });

    // まず全期間で累計を計算
    reports.forEach(r => {
        const current = staffStatsMap.get(r.staff) || { sales: 0, share: 0, totalSales: 0, totalShare: 0 };
        staffStatsMap.set(r.staff, {
            ...current,
            totalSales: current.totalSales + r.totalSales,
            totalShare: current.totalShare + r.staffShare
        });
    });

    // 次に今月分を計算
    monthReports.forEach(r => {
        const current = staffStatsMap.get(r.staff) || { sales: 0, share: 0, totalSales: 0, totalShare: 0 };
        staffStatsMap.set(r.staff, {
            ...current,
            sales: current.sales + r.totalSales,
            share: current.share + r.staffShare
        });
    });

    let staffStats = Array.from(staffStatsMap.entries())
        .map(([name, stats]) => ({ name, ...stats }));

    if (staffSearchQuery.trim()) {
        staffStats = staffStats.filter(s => s.name.toLowerCase().includes(staffSearchQuery.toLowerCase()));
    }

    staffStats.sort((a, b) => {
        if (staffSortOption === 'sales_desc') return b.sales - a.sales;
        if (staffSortOption === 'totalSales_desc') return b.totalSales - a.totalSales;
        return a.name.localeCompare(b.name, 'ja');
    });

    // フェーズ6: 売上推移（直近6ヶ月、スライド機能付き）
    const trendData = [];
    if (selectedMonth) {
        const baseDate = new Date(`${selectedMonth}-01`);
        // trendOffsetを使用してスライド位置を調整（0なら現在月基準、-6なら前期間6ヶ月、+6なら次期間6ヶ月）
        for (let i = 5; i >= 0; i--) {
            const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i + trendOffset, 1);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const monthKey = `${yyyy}-${mm}`;

            const mReports = reports.filter(r => {
                const rd = new Date(r.date);
                return rd.getFullYear() === yyyy && String(rd.getMonth() + 1).padStart(2, '0') === mm;
            });

            const mSales = mReports.reduce((sum, r) => sum + r.totalSales, 0);
            const mProfit = mReports.reduce((sum, r) => sum + (r.totalSales - r.staffShare), 0);

            trendData.push({
                monthStr: `${d.getMonth() + 1}月`,
                fullMonth: monthKey,
                sales: mSales,
                profit: mProfit
            });
        }
    }
    const maxTrendSales = Math.max(...trendData.map(d => d.sales), 1);

    // フェーズ5: お客様一覧の生成（デポジット利用者優先＋その他のソート）
    const customerMap = new Map<string, { totalPaid: number, registeredDate: string }>();
    reports.forEach(r => {
        if (r.customerName) {
            const current = customerMap.get(r.customerName) || {
                totalPaid: 0,
                registeredDate: r.date
            };
            // 報告がある＝利用があったとみなし、isPaidに関わらず累計売上に加算する
            current.totalPaid += r.totalSales;

            if (new Date(r.date) < new Date(current.registeredDate)) {
                current.registeredDate = r.date;
            }
            customerMap.set(r.customerName, current);
        }
    });

    Object.keys(deposits).forEach(name => {
        if (!customerMap.has(name)) {
            customerMap.set(name, { totalPaid: 0, registeredDate: new Date().toISOString() });
        }
    });

    // 登録日ベースでお客様番号（連番）を割り当てるために一時ソート
    const allCustomers = Array.from(customerMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => new Date(a.registeredDate).getTime() - new Date(b.registeredDate).getTime());

    const customerList = allCustomers.map((customer, index) => {
        const balance = deposits[customer.name] || 0;
        const phone = customerPhones[customer.name] || '登録なし';

        // 通話回数と今月の利用額を計算
        const customerReports = reports.filter(r => r.customerName === customer.name);
        const callCount = customerReports.length;
        const monthlyReports = monthReports.filter(r => r.customerName === customer.name);
        const monthlyAmount = monthlyReports.reduce((sum, r) => sum + r.totalSales, 0);

        return {
            name: customer.name,
            phone,
            balance,
            totalPaid: customer.totalPaid,
            registeredDate: customer.registeredDate,
            customerNumber: index + 1,
            callCount,
            monthlyAmount
        };
    }).sort((a, b) => {
        if (customerSortBy === 'deposit') {
            if (a.balance > 0 && b.balance === 0) return -1;
            if (a.balance === 0 && b.balance > 0) return 1;
            if (a.totalPaid !== b.totalPaid) return b.totalPaid - a.totalPaid;
            return a.name.localeCompare(b.name, 'ja');
        }
        if (customerSortBy === 'paid_desc') {
            return b.totalPaid - a.totalPaid;
        }
        if (customerSortBy === 'registered_asc') {
            return new Date(a.registeredDate).getTime() - new Date(b.registeredDate).getTime();
        }
        if (customerSortBy === 'registered_desc') {
            return new Date(b.registeredDate).getTime() - new Date(a.registeredDate).getTime();
        }
        if (customerSortBy === 'number_asc') {
            return a.customerNumber - b.customerNumber;
        }
        if (customerSortBy === 'name_asc') {
            return a.name.localeCompare(b.name, 'ja');
        }
        return 0;
    }).filter(customer => {
        if (showBlacklistOnly && (!customer.phone || !blacklistedPhones.includes(customer.phone))) return false;
        if (customerSearchQuery.trim()) {
            const query = customerSearchQuery.trim().toLowerCase();
            return customer.name.toLowerCase().includes(query) || (customer.phone && customer.phone.includes(query));
        }
        return true;
    });

    // 全体の稼働スタッフ数と通話件数（ダッシュボード用）
    const activeStaffCount = new Set(monthReports.map(r => r.staff)).size;
    const totalCalls = monthReports.length;
    const paidCount = monthReports.filter(r => r.isPaid).length;
    const unpaidMonthCount = monthReports.filter(r => !r.isPaid).length;

    return (
        <div className="flex min-h-screen bg-[var(--background)]">
            {/* Sidebar */}
            <aside className="w-56 bg-[#181824] border-r border-[#242436] text-white flex-col hidden md:flex shrink-0 print:hidden sticky top-0 h-screen overflow-y-auto z-50">
                <div className="p-4 py-5 border-b border-[#242436]">
                    <h1 className="text-lg font-bold flex items-center gap-2">
                        📞 通話管理
                    </h1>
                    <p className="text-[10px] text-gray-400 mt-1 pl-6">管理システム</p>
                </div>
                <nav className="flex-1 py-4 flex flex-col gap-1">
                    <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors text-sm ${activeTab === 'dashboard' ? 'bg-[#242436] text-white font-bold border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#1a1a28] hover:text-gray-200 border-l-4 border-transparent'}`}>
                        <span className="text-lg">📊</span>
                        <span>ダッシュボード</span>
                    </button>
                    <button onClick={() => setActiveTab('reports')} className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors text-sm ${activeTab === 'reports' ? 'bg-[#242436] text-white font-bold border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#1a1a28] hover:text-gray-200 border-l-4 border-transparent'}`}>
                        <span className="text-lg">📄</span>
                        <span>業務報告一覧</span>
                    </button>
                    <button onClick={() => setActiveTab('staff')} className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors text-sm ${activeTab === 'staff' ? 'bg-[#242436] text-white font-bold border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#1a1a28] hover:text-gray-200 border-l-4 border-transparent'}`}>
                        <span className="text-lg">👥</span>
                        <span>スタッフ管理</span>
                    </button>
                    <button onClick={() => setActiveTab('customers')} className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors text-sm ${activeTab === 'customers' ? 'bg-[#242436] text-white font-bold border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#1a1a28] hover:text-gray-200 border-l-4 border-transparent'}`}>
                        <span className="text-lg">📱</span>
                        <span>顧客管理</span>
                    </button>
                    <button onClick={() => setActiveTab('deposit')} className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors text-sm ${activeTab === 'deposit' ? 'bg-[#242436] text-white font-bold border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#1a1a28] hover:text-gray-200 border-l-4 border-transparent'}`}>
                        <span className="text-lg">💰</span>
                        <span>デポジット管理</span>
                    </button>
                    <div className="pt-4 mt-2 border-t border-[#242436]">
                        <a href="/mypage" target="_blank" className="w-full text-left px-5 py-3 flex items-center gap-3 transition-colors text-gray-400 hover:bg-[#1a1a28] hover:text-gray-200 border-l-4 border-transparent text-sm">
                            <span className="text-lg">✏️</span>
                            <span>業務報告入力</span>
                        </a>
                    </div>
                </nav>
                <div className="p-4 text-center pb-6">
                    <span className="bg-red-400 text-white font-bold text-[10px] py-1 rounded-full px-6">DEMO</span>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-x-hidden bg-gray-50/50 dark:bg-[#000000]">
                {/* Header (Top Nav Replacement) */}
                <header className="bg-white dark:bg-[#111111] border-b border-gray-200 dark:border-gray-800 px-6 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-40 print:hidden h-[72px]">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                        {activeTab === 'dashboard' && 'ダッシュボード'}
                        {activeTab === 'reports' && '業務報告一覧 / 入金確認'}
                        {activeTab === 'staff' && 'スタッフ管理 / 給与計算'}
                        {activeTab === 'customers' && '顧客管理'}
                        {activeTab === 'deposit' && 'デポジット管理'}
                    </h2>

                    <div className="flex items-center gap-4">
                        <div className="relative bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1">
                            <button onClick={handlePrevMonth} className="hover:bg-gray-200 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors">
                                &lt;
                            </button>
                            <button onClick={() => setShowMonthPicker(!showMonthPicker)} className="hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-1 rounded transition-colors min-w-[90px]">
                                {selectedMonth.replace('-', '年')}月
                            </button>
                            <button onClick={handleNextMonth} className="hover:bg-gray-200 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors">
                                &gt;
                            </button>
                            {showMonthPicker && (
                                <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50 min-w-[120px]">
                                    {generateMonthOptions().map((month) => (
                                        <button
                                            key={month}
                                            onClick={() => {
                                                setSelectedMonth(month);
                                                setShowMonthPicker(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${month === selectedMonth ? 'bg-blue-50 dark:bg-blue-900/30 font-bold' : ''}`}
                                        >
                                            {month.replace('-', '年')}月
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="hidden sm:flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300">
                            <span>👤 オーナー</span>
                        </div>
                        <button onClick={handleRefreshData} disabled={isRefreshing} className={`flex items-center gap-1.5 px-3 py-1.5 ${isRefreshing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} rounded-lg text-sm transition-all`} title="最新に更新">
                            <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-gray-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    </div>
                </header>

                <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 pb-32 print:p-0 print:m-0 print:space-y-0 print:pb-0 print:max-w-none">
                    <div className="print:hidden space-y-8">

                        {activeTab === 'dashboard' && (
                            <>
                                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-indigo-400 flex flex-col justify-center">
                                        <p className="text-xs text-gray-500 font-medium mb-1">年間累計売上</p>
                                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100">¥{totalYearSales.toLocaleString()}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">{currentYear}年</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-teal-400 flex flex-col justify-center">
                                        <p className="text-xs text-gray-500 font-medium mb-1">月間売上</p>
                                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100">¥{totalMonthSales.toLocaleString()}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">{selectedMonth.replace('-', '年')}月</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-blue-400 flex flex-col justify-center">
                                        <p className="text-xs text-gray-500 font-medium mb-1">オーナー取り分</p>
                                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100">¥{totalMonthProfit.toLocaleString()}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">全体の{totalMonthSales > 0 ? Math.round(totalMonthProfit / totalMonthSales * 100) : 0}%</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-red-400 flex flex-col justify-center">
                                        <p className="text-xs text-gray-500 font-medium mb-1">未入金額</p>
                                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100">¥{totalUnpaid.toLocaleString()}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">{unpaidCount}件未入金</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-purple-400 flex flex-col justify-center">
                                        <p className="text-xs text-gray-500 font-medium mb-1">通話件数</p>
                                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{totalCalls}件</p>
                                        <p className="text-[10px] text-gray-400 mt-1">稼働スタッフ {activeStaffCount}名</p>
                                    </div>
                                </section>

                                {/* 売上推移チャート */}
                                <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-4">
                                    <div className="flex items-center justify-between border-b dark:border-gray-700 border-gray-100 pb-2">
                                        <h2 className="font-bold text-gray-800 dark:text-gray-200">売上推移（直近6ヶ月）</h2>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setTrendOffset(trendOffset - 6)} className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
                                                &lt; 前期間
                                            </button>
                                            <button onClick={() => setTrendOffset(0)} disabled={trendOffset === 0} className={`px-3 py-1 text-sm ${trendOffset === 0 ? 'bg-gray-200 dark:bg-gray-700 opacity-50 cursor-not-allowed' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'} rounded transition-colors`}>
                                                今月
                                            </button>
                                            <button onClick={() => setTrendOffset(trendOffset + 6)} disabled={trendOffset >= 0} className={`px-3 py-1 text-sm ${trendOffset >= 0 ? 'bg-gray-200 dark:bg-gray-700 opacity-50 cursor-not-allowed' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'} rounded transition-colors`}>
                                                次期間 &gt;
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-end justify-between gap-1 sm:gap-4 h-48 mt-4">
                                        {trendData.map((data, idx) => (
                                            <div key={idx} className="flex flex-col items-center flex-1 gap-2">
                                                <div className="w-full flex justify-center items-end h-36 relative group">
                                                    {/* ツールチップ */}
                                                    <div className="absolute -top-8 bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none font-medium">
                                                        ¥{(data.sales / 10000).toFixed(1)}万
                                                    </div>
                                                    {/* バー本体 */}
                                                    <div
                                                        className="w-1/2 max-w-[40px] bg-[#4cd9c0] hover:bg-[#3dbfa8] rounded-t-sm transition-all duration-500 ease-out cursor-pointer"
                                                        style={{ height: `${Math.max((data.sales / maxTrendSales) * 100, 1)}%` }}
                                                    ></div>
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 font-bold whitespace-nowrap">{data.monthStr}</div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* スタッフ別実績（ダッシュボード用） */}
                                <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden mt-6">
                                    <h2 className="font-bold text-gray-800 dark:text-gray-200 border-b dark:border-gray-700 border-gray-100 dark:border-gray-700 pb-2 mb-3 flex items-center gap-2">
                                        👥 スタッフ別売上サマリー
                                    </h2>
                                    <div className="overflow-x-auto relative">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="text-gray-500 font-medium border-b border-gray-100 dark:border-gray-700">
                                                    <th className="py-2 px-4">スタッフ名</th>
                                                    <th className="py-2 px-4">売上合計</th>
                                                    <th className="py-2 px-4">スタッフ取り分</th>
                                                    <th className="py-2 px-4">オーナー取り分</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {staffStats.length === 0 ? (
                                                    <tr><td colSpan={4} className="text-center py-6 text-gray-400 dark:text-gray-500">データがありません</td></tr>
                                                ) : (
                                                    staffStats.map(s => (
                                                        <tr key={s.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                            <td className="py-3 px-4 font-bold text-gray-800 dark:text-gray-200">{s.name}</td>
                                                            <td className="py-3 px-4">¥{s.sales.toLocaleString()}</td>
                                                            <td className="py-3 px-4">¥{s.share.toLocaleString()}</td>
                                                            <td className="py-3 px-4">¥{(s.sales - s.share).toLocaleString()}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            </>
                        )}

                        {activeTab === 'reports' && (
                            <>
                                <section className="flex flex-wrap gap-3 mb-6">
                                    <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-lg shadow-sm border-l-4 border-teal-400 flex items-center gap-3">
                                        <p className="text-xs text-gray-500 font-medium">入金済み</p>
                                        <p className="text-xl font-black text-gray-900 dark:text-gray-100">{paidCount}件</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-lg shadow-sm border-l-4 border-red-400 flex items-center gap-3">
                                        <p className="text-xs text-gray-500 font-medium">未入金</p>
                                        <p className="text-xl font-black text-gray-900 dark:text-gray-100">{unpaidMonthCount}件</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 px-4 py-3 rounded-lg shadow-sm border-l-4 border-blue-400 flex items-center gap-3">
                                        <p className="text-xs text-gray-500 font-medium">未入金合計</p>
                                        <p className="text-xl font-black text-gray-900 dark:text-gray-100">¥{totalUnpaid.toLocaleString()}</p>
                                    </div>
                                </section>

                                <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
                                    <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                                        <h2 className="font-semibold text-gray-800 dark:text-gray-200">業務報告一覧</h2>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">※チェックで入金確認</span>
                                    </div>
                                    <div className="overflow-x-auto relative">

                                        {/* ローディング表示とエラー表示 */}
                                        {isLoading && (
                                            <div className="absolute inset-0 bg-white dark:bg-gray-800/70 flex justify-center items-center z-10 backdrop-blur-sm">
                                                <span className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">データを取得中...</span>
                                            </div>
                                        )}
                                        {errorText && (
                                            <div className="p-4 bg-red-50 text-red-600 text-sm border-b dark:border-gray-700 font-medium">
                                                {errorText}
                                            </div>
                                        )}

                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-transparent border-b dark:border-gray-700">
                                                <tr className="text-gray-600 dark:text-gray-400">
                                                    <th className="px-6 py-4 font-medium">入金</th>
                                                    <th className="px-6 py-4 font-medium">日付</th>
                                                    <th className="px-6 py-4 font-medium">スタッフ</th>
                                                    <th className="px-6 py-4 font-medium">お客様名</th>
                                                    <th className="px-6 py-4 font-medium">電話番号</th>
                                                    <th className="px-6 py-4 font-medium">サービス</th>
                                                    <th className="px-6 py-4 font-medium">金額</th>
                                                    <th className="px-6 py-4 font-medium">入金日</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {monthReports.length === 0 && !isLoading && !errorText && (
                                                    <tr>
                                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                                                            当月の報告データがありません
                                                        </td>
                                                    </tr>
                                                )}
                                                {monthReports.map((report) => {
                                                    const isEditing = editingReportId === report.id;
                                                    return (
                                                        <tr key={report.id} className="hover:bg-gray-50/50 dark:bg-gray-800/50 transition-colors border-b dark:border-gray-700">
                                                            <td className="px-6 py-4">
                                                                <button
                                                                    onClick={() => togglePaidStatus(report.id, report.isPaid)}
                                                                    className={`w-5 h-5 flex items-center justify-center rounded transition-colors border shadow-sm ${report.isPaid ? 'bg-[#4cd9c0] border-transparent text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}`}
                                                                >
                                                                    {report.isPaid && <span className="text-sm">✓</span>}
                                                                </button>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">{report.date}</td>
                                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{report.staff}</td>
                                                            <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{report.customerName}</td>
                                                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{report.customerPhone}</td>
                                                            <td className="px-6 py-4">
                                                                {report.services.split(', ').map(s => {
                                                                    const parsedService = parseServiceName(s);
                                                                    let bgClass = "bg-blue-50 text-blue-600";
                                                                    if (s.includes('占い')) bgClass = "bg-pink-50 text-pink-600";
                                                                    if (s.includes('性的')) bgClass = "bg-yellow-50 text-yellow-700";
                                                                    return <span key={s} className={`text-[11px] px-2 py-0.5 rounded mr-1 ${bgClass}`}>{parsedService}</span>;
                                                                })}
                                                            </td>
                                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">¥{report.totalSales.toLocaleString()}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`text-[12px] font-bold ${report.isPaid ? 'text-[#4cd9c0]' : 'text-red-400'}`}>
                                                                    {report.isPaid ? formatPaymentDate(report.paymentDate || report.date) : '未入金'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            </>
                        )}

                        {/* スタッフ管理 (新規追加・給与明細等) */}
                        {activeTab === 'staff' && (
                            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
                                <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5 border-b dark:border-gray-800 bg-white dark:bg-[#111111]">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">スタッフ管理</h2>
                                        <input
                                            type="month"
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(e.target.value)}
                                            className="border-none bg-gray-100 dark:bg-gray-800 rounded-lg pl-3 pr-2 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all cursor-pointer"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                                            <input
                                                type="text"
                                                placeholder="名前で検索"
                                                className="border border-gray-200 dark:border-gray-700 pl-8 pr-4 py-1.5 text-sm rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-800 dark:text-gray-200 w-48 focus:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                                value={staffSearchQuery}
                                                onChange={(e) => setStaffSearchQuery(e.target.value)}
                                            />
                                        </div>

                                        <select
                                            value={staffSortOption}
                                            onChange={(e) => setStaffSortOption(e.target.value as any)}
                                            className="border-none bg-transparent text-gray-600 dark:text-gray-400 focus:outline-none font-medium text-sm cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                                        >
                                            <option value="sales_desc">売上順</option>
                                            <option value="totalSales_desc">累計順</option>
                                            <option value="name_asc">五十音</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="overflow-x-auto relative p-6">
                                    <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                                        <thead className="bg-transparent text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                                            <tr className="bg-indigo-50/30 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800">
                                                <td colSpan={4} className="px-6 py-4">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 mr-2">✨ クイック追加</span>
                                                        <input
                                                            type="text"
                                                            id="quickStaffName"
                                                            placeholder="スタッフ名 (必須)"
                                                            className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium"
                                                        />
                                                        <input
                                                            type="text"
                                                            id="quickStaffPass"
                                                            placeholder="ログインパスワード (必須)"
                                                            className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium"
                                                        />
                                                        <input
                                                            type="email"
                                                            id="quickStaffEmail"
                                                            placeholder="メールアドレス (必須)"
                                                            className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium w-48"
                                                        />
                                                        <button
                                                            onClick={async () => {
                                                                const n = (document.getElementById('quickStaffName') as HTMLInputElement).value;
                                                                const p = (document.getElementById('quickStaffPass') as HTMLInputElement).value;
                                                                const e = (document.getElementById('quickStaffEmail') as HTMLInputElement).value;
                                                                if (!n || !p || !e) return alert('スタッフ名、パスワード、メールアドレスはすべて必須です');
                                                                try {
                                                                    const btn = document.getElementById('quickStaffBtn') as HTMLButtonElement;
                                                                    btn.disabled = true;
                                                                    btn.innerText = '追加中...';
                                                                    await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'addStaff', name: n, password: p, email: e }) });
                                                                    setStaffEmails(prev => ({ ...prev, [n]: e }));
                                                                    fetchStaffList();
                                                                    (document.getElementById('quickStaffName') as HTMLInputElement).value = '';
                                                                    (document.getElementById('quickStaffPass') as HTMLInputElement).value = '';
                                                                    (document.getElementById('quickStaffEmail') as HTMLInputElement).value = '';
                                                                    btn.disabled = false;
                                                                    btn.innerText = '＋ 追加する';
                                                                } catch (err) {
                                                                    alert('エラーが発生しました');
                                                                    const btn = document.getElementById('quickStaffBtn') as HTMLButtonElement;
                                                                    btn.disabled = false;
                                                                    btn.innerText = '＋ 追加する';
                                                                }
                                                            }}
                                                            id="quickStaffBtn"
                                                            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold px-4 py-1.5 rounded-lg text-sm hover:bg-gray-800 dark:hover:bg-white transition-colors shadow-sm whitespace-nowrap ml-auto"
                                                        >
                                                            ＋ 追加する
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr className="bg-gray-50 dark:bg-gray-900">
                                                <th className="px-6 py-3 font-medium">スタッフ名</th>
                                                <th className="px-6 py-3 font-medium text-right">今月の報酬額</th>
                                                <th className="px-6 py-3 font-medium text-right">累計の報酬額</th>
                                                <th className="px-6 py-3 font-medium text-center">操作・アクション</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {staffStats.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">データがありません</td>
                                                </tr>
                                            )}
                                            {staffStats.map((s) => {
                                                return (
                                                    <tr key={s.name} className="hover:bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-gray-900 dark:text-gray-100">{s.name}</div>
                                                            {editingStaffName === s.name ? (
                                                                <div className="mt-2 flex flex-col gap-2">
                                                                    <input type="password" placeholder="新しいパスワード(空で変更なし)" value={editStaffData.password} onChange={e => setEditStaffData({ ...editStaffData, password: e.target.value })} className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs rounded w-full focus:outline-none focus:border-b dark:border-gray-700lue-500" />
                                                                    <input type="email" placeholder="メールアドレス" value={editStaffData.email} onChange={e => setEditStaffData({ ...editStaffData, email: e.target.value })} className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs rounded w-full focus:outline-none focus:border-b dark:border-gray-700lue-500" />
                                                                    <div className="flex gap-2">
                                                                        <button onClick={async () => {
                                                                            try {
                                                                                await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'editStaff', name: s.name, password: editStaffData.password, email: editStaffData.email }) });
                                                                                if (editStaffData.email) setStaffEmails((prev) => ({ ...prev, [s.name]: editStaffData.email }));
                                                                                setEditingStaffName(null);
                                                                                alert('更新しました。');
                                                                            } catch (err) { alert('エラーが発生しました'); }
                                                                        }} className="text-[10px] bg-blue-600 text-white font-bold px-3 py-1 rounded shadow-sm hover:bg-blue-700">一括で保存</button>
                                                                        <button onClick={() => setEditingStaffName(null)} className="text-[10px] bg-gray-200 text-gray-700 dark:text-gray-300 font-bold px-3 py-1 rounded shadow-sm hover:bg-gray-300">キャンセル</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex gap-2 mt-1">
                                                                    <button onClick={() => {
                                                                        setEditingStaffName(s.name);
                                                                        setEditStaffData({ password: '', email: staffEmails[s.name] || '' });
                                                                    }} className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:text-gray-200 underline">設定変更</button>
                                                                    <button onClick={async () => {
                                                                        if (!window.confirm(`${s.name}さんを本当に削除してもよろしいですか？\n(過去の報告は残りますがログインはできなくなります)`)) return;
                                                                        try {
                                                                            await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteStaff', name: s.name }) });
                                                                            setStaffEmails((prev) => { const n = { ...prev }; delete n[s.name]; return n; });
                                                                            alert('削除しました。');
                                                                        } catch (err) { alert('エラーが発生しました'); }
                                                                    }} className="text-[10px] text-red-400 hover:text-red-700 underline">削除</button>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="font-medium text-gray-900 dark:text-gray-100">¥{s.share.toLocaleString()}</div>
                                                            <div className="text-[10px] text-gray-400 dark:text-gray-500">売上: ¥{s.sales.toLocaleString()}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="font-medium text-gray-900 dark:text-gray-100">¥{s.totalShare.toLocaleString()}</div>
                                                            <div className="text-[10px] text-gray-400 dark:text-gray-500">売上: ¥{s.totalSales.toLocaleString()}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-wrap items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => setShowStaffDetailFor(s.name)}
                                                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs font-bold hover:bg-indigo-100 transition-colors">
                                                                    👁️ 詳細
                                                                </button>
                                                                <button
                                                                    onClick={() => setSelectedPdfStaff(s.name)}
                                                                    className="px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded text-xs font-bold hover:bg-gray-50 dark:bg-gray-900 transition-colors">
                                                                    📄 明細PDF作成
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        const toEmail = staffEmails[s.name];
                                                                        if (!toEmail) {
                                                                            alert(`${s.name}さんのメールアドレスが登録されていません。「スタッフ一覧」を確認してください。`);
                                                                            return;
                                                                        }
                                                                        if (!window.confirm(`${s.name}さん (${toEmail}) へ給与明細メールを送信しますか？`)) return;

                                                                        try {
                                                                            const res = await fetch(GAS_URL, {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'text/plain' },
                                                                                body: JSON.stringify({
                                                                                    action: 'sendEmail',
                                                                                    to: toEmail,
                                                                                    subject: `【ハナシタラ.com】${currentMonthStr.replace('-', '年')}月分 給与明細のお知らせ`,
                                                                                    body: `${s.name} 様\n\nお疲れ様です。ハナシタラ.comです。\n${currentMonthStr.replace('-', '年')}月分の給与計算が完了いたしました。\n\n【合計振込額】: ¥${s.share.toLocaleString()}\n\n詳細はスタッフマイページにログインの上、PDFにてご確認ください。\n引き続きよろしくお願いいたします。`
                                                                                })
                                                                            });
                                                                            const json = await res.json();
                                                                            if (json.success) {
                                                                                alert('メールを送信しました！');
                                                                            } else {
                                                                                alert(`送信に失敗しました。\n理由: ${json.message || '不明なエラー'}`);
                                                                            }
                                                                        } catch (e) {
                                                                            console.error('通信エラー:', e);
                                                                            alert('通信エラーが発生したため、送信できませんでした。');
                                                                        }
                                                                    }}
                                                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded text-xs font-bold hover:bg-blue-100 transition-colors">
                                                                    ✉️ メール送信
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {/* お客様管理タブ */}
                        {activeTab === 'customers' && (
                            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
                                <div className="px-4 py-3 border-b dark:border-gray-800 bg-white dark:bg-[#111111] flex flex-col gap-3">
                                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">お客様管理</h2>
                                            <button
                                                onClick={() => setShowAddCustomerModal(true)}
                                                className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold px-4 py-1.5 rounded-lg text-sm hover:bg-gray-800 dark:hover:bg-white transition-colors shadow-sm whitespace-nowrap"
                                            >
                                                ＋ 追加する
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                                                <input
                                                    type="text"
                                                    placeholder="名前・電話番号で検索..."
                                                    className="border border-gray-200 dark:border-gray-700 pl-8 pr-4 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-800 dark:text-gray-200 w-56 focus:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm"
                                                    value={customerSearchQuery}
                                                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                                />
                                            </div>

                                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={showBlacklistOnly}
                                                    onChange={(e) => setShowBlacklistOnly(e.target.checked)}
                                                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 w-4 h-4"
                                                />
                                                <span className="font-medium text-sm">NG顧客</span>
                                            </label>

                                            <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden sm:block"></div>

                                            <select
                                                value={customerSortBy}
                                                onChange={(e) => setCustomerSortBy(e.target.value as CustomerSortOption)}
                                                className="border-none bg-transparent text-gray-600 dark:text-gray-400 focus:outline-none font-medium text-sm cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                                            >
                                                <option value="registered_desc">新着順</option>
                                                <option value="registered_asc">古い順</option>
                                                <option value="name_asc">五十音</option>
                                                <option value="number_asc">番号順</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto relative p-4">
                                    <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => setCustomerSortBy('name_asc')}>名前 {customerSortBy === 'name_asc' ? '▲' : ''}</th>
                                                <th className="px-4 py-3 font-medium">電話番号</th>
                                                <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => setCustomerSortBy('registered_desc')}>登録日 {customerSortBy === 'registered_desc' ? '▼' : ''}</th>
                                                <th className="px-4 py-3 font-medium text-right">通話回数</th>
                                                <th className="px-4 py-3 font-medium text-right">今月の通話利用額</th>
                                                <th className="px-4 py-3 font-medium text-right">累計利用額</th>
                                                <th className="px-4 py-3 font-medium text-center">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {customerList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                                                        データがありません。上の「＋ 追加する」ボタンから顧客を追加してください。
                                                    </td>
                                                </tr>
                                            ) : (
                                                customerList.map(({ name: customerName, phone, registeredDate, customerNumber, callCount, monthlyAmount, totalPaid, balance }) => (
                                                    <tr key={customerName} className="hover:bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-gray-900 dark:text-gray-100">{customerName}</span>
                                                                {blacklistedPhones.includes(phone) && phone && phone !== '登録なし' && (
                                                                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-200 whitespace-nowrap">NG</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-gray-600 dark:text-gray-400 text-sm">{phone}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-gray-500 dark:text-gray-400 text-sm">
                                                                {new Date(registeredDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="text-gray-700 dark:text-gray-300 font-medium">{callCount}回</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="text-gray-700 dark:text-gray-300 font-medium">¥{monthlyAmount.toLocaleString()}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="text-gray-900 dark:text-gray-100 font-bold">¥{totalPaid.toLocaleString()}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                                                                <button
                                                                    onClick={() => {
                                                                        setChargeTarget(customerName);
                                                                        setShowChargeModal(true);
                                                                    }}
                                                                    className="px-2.5 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700 rounded text-xs font-bold hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap">
                                                                    💰 チャージ
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setShowHistoryForCustomer(customerName);
                                                                        if (depositLogs.length === 0) fetchDepositLogs(customerName);
                                                                    }}
                                                                    className="px-2.5 py-1 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap">
                                                                    📜 履歴
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingCustomerName(customerName);
                                                                        setEditCustomerData({ customerName: customerName, customerPhone: phone === '登録なし' ? '' : phone });
                                                                    }}
                                                                    className="px-2.5 py-1 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors whitespace-nowrap">
                                                                    ⚙️ 設定
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* 顧客編集モーダル */}
                                {editingCustomerName && (
                                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingCustomerName(null)}>
                                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">顧客情報の編集</h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">お客様名</label>
                                                    <input
                                                        type="text"
                                                        value={editCustomerData.customerName}
                                                        onChange={(e) => setEditCustomerData({ ...editCustomerData, customerName: e.target.value })}
                                                        className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">電話番号</label>
                                                    <input
                                                        type="text"
                                                        value={editCustomerData.customerPhone}
                                                        onChange={(e) => setEditCustomerData({ ...editCustomerData, customerPhone: e.target.value })}
                                                        className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-3 mt-6">
                                                <button
                                                    onClick={() => setEditingCustomerName(null)}
                                                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    キャンセル
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            setEditingCustomerName(null);
                                                            await fetch(GAS_URL, {
                                                                method: 'POST',
                                                                body: JSON.stringify({
                                                                    action: 'editCustomer',
                                                                    oldName: editingCustomerName,
                                                                    newName: editCustomerData.customerName,
                                                                    phone: editCustomerData.customerPhone
                                                                })
                                                            });
                                                            fetchDeposits();
                                                            fetchReports();
                                                            alert('お客様情報を更新しました。');
                                                        } catch (e) {
                                                            alert('エラーが発生しました。');
                                                        }
                                                    }}
                                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                                                >
                                                    保存する
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* デポジット管理タブ */}
                        {activeTab === 'deposit' && (
                            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
                                <div className="px-6 py-5 border-b dark:border-gray-800 bg-white dark:bg-[#111111] flex flex-col gap-4">
                                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">デポジット管理</h2>

                                            <div className="hidden sm:flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800">
                                                <span className="text-[11px] font-semibold text-indigo-500 dark:text-indigo-400">ボーナス還元:</span>
                                                <input type="number" value={bonusThreshold} onChange={e => setBonusThreshold(Number(e.target.value))} className="w-14 text-right bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:outline-none text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors pb-px" />
                                                <span className="text-xs text-gray-500">円 =</span>
                                                <input type="number" value={bonusRate} onChange={e => setBonusRate(Number(e.target.value))} className="w-8 text-right bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:outline-none text-xs font-semibold text-gray-800 dark:text-gray-200 transition-colors pb-px" />
                                                <span className="text-xs text-gray-500">%</span>
                                                <button onClick={() => {
                                                    localStorage.setItem('depositBonusThreshold', String(bonusThreshold));
                                                    localStorage.setItem('depositBonusRate', String(bonusRate));
                                                    alert('次回のチャージから設定されたボーナス条件が適用されます。');
                                                }} className="ml-2 text-[11px] font-bold text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">設定</button>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4">
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                                                <input
                                                    type="text"
                                                    placeholder="名前・電話番号で検索..."
                                                    className="border border-gray-200 dark:border-gray-700 pl-8 pr-4 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-gray-800 dark:text-gray-200 w-56 focus:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm"
                                                    value={customerSearchQuery}
                                                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                                />
                                            </div>

                                            <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden sm:block"></div>

                                            <select
                                                value={customerSortBy}
                                                onChange={(e) => setCustomerSortBy(e.target.value as CustomerSortOption)}
                                                className="border-none bg-transparent text-gray-600 dark:text-gray-400 focus:outline-none font-medium text-sm cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                                            >
                                                <option value="deposit">前払い順</option>
                                                <option value="paid_desc">支払額順</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto relative p-6">
                                    <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                                        <thead className="bg-transparent text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                                            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                                <th className="px-6 py-3 font-medium">No.</th>
                                                <th className="px-6 py-3 font-medium">お客様名</th>
                                                <th className="px-6 py-3 font-medium text-right">現在の前払い残高</th>
                                                <th className="px-6 py-3 font-medium text-right cursor-pointer" onClick={() => setCustomerSortBy('paid_desc')}>累計支払額 {customerSortBy === 'paid_desc' ? '▼' : ''}</th>
                                                <th className="px-6 py-3 font-medium text-center">操作・アクション</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {customerList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                                                        データがありません。顧客管理タブのクイック追加からお試しください。
                                                    </td>
                                                </tr>
                                            ) : (
                                                customerList.map(({ name: customerName, phone, balance, totalPaid, customerNumber }) => (
                                                    <tr key={customerName} className={`transition-colors ${balance > 0 ? 'bg-indigo-50/50' : 'hover:bg-gray-50/50 dark:bg-gray-800/50'}`}>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="text-gray-400 dark:text-gray-500 font-medium">{customerNumber}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="font-bold text-gray-900 dark:text-gray-100">{customerName}</span>
                                                                <span className="text-[11px] text-gray-400 dark:text-gray-500">{phone}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className={`font-bold ${balance > 0 ? 'text-indigo-600' : 'text-gray-400 dark:text-gray-500'}`}>¥{balance.toLocaleString()}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="text-gray-600 dark:text-gray-400 font-medium">¥{totalPaid.toLocaleString()}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-wrap items-center justify-center gap-2">
                                                                <button
                                                                    onClick={async () => {
                                                                        const input = window.prompt(`${customerName} 様の追加前払い額（例: 5000）を入力してください。`);
                                                                        if (input && !isNaN(Number(input))) {
                                                                            const val = Number(input);
                                                                            const bonus = val >= bonusThreshold ? Math.floor(val * (bonusRate / 100)) : 0;
                                                                            const total = val + bonus;
                                                                            const confirmed = window.confirm(`追加額: ¥${val.toLocaleString()}\n特典(${bonusRate}%): ¥${bonus.toLocaleString()}\n\n合計 ¥${total.toLocaleString()} をチャージしますか？`);
                                                                            if (confirmed) {
                                                                                setDeposits(prev => ({
                                                                                    ...prev,
                                                                                    [customerName]: (prev[customerName] || 0) + total
                                                                                }));
                                                                                try {
                                                                                    await fetch(GAS_URL, {
                                                                                        method: 'POST',
                                                                                        headers: { 'Content-Type': 'text/plain' },
                                                                                        body: JSON.stringify({ action: 'updateDeposit', customerName, amount: total, type: 'charge' })
                                                                                    });
                                                                                } catch (e) { console.error(e); }
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="flex-1 min-w-[100px] px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded text-xs font-bold hover:bg-indigo-100 transition-colors whitespace-nowrap text-center">
                                                                    💰 チャージ追加
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        const input = window.prompt(`${customerName} 様のご利用金額を差し引きます。金額を入力してください。（現在の残高: ¥${balance.toLocaleString()}）`);
                                                                        if (input && !isNaN(Number(input))) {
                                                                            const val = Number(input);
                                                                            if (val > balance) {
                                                                                alert('残高不足です。');
                                                                                return;
                                                                            }
                                                                            const confirmed = window.confirm(`¥${val.toLocaleString()} を残高から差し引きますか？`);
                                                                            if (confirmed) {
                                                                                setDeposits(prev => ({
                                                                                    ...prev,
                                                                                    [customerName]: prev[customerName] - val
                                                                                }));
                                                                                try {
                                                                                    await fetch(GAS_URL, {
                                                                                        method: 'POST',
                                                                                        headers: { 'Content-Type': 'text/plain' },
                                                                                        body: JSON.stringify({ action: 'updateDeposit', customerName, amount: -val, type: 'use' })
                                                                                    });
                                                                                } catch (e) { console.error(e); }
                                                                            }
                                                                        }
                                                                    }}
                                                                    disabled={balance === 0}
                                                                    className={`flex-1 min-w-[100px] px-3 py-1.5 rounded text-xs font-bold transition-colors border whitespace-nowrap text-center ${balance === 0
                                                                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                                                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:bg-gray-900'
                                                                        }`}>
                                                                    ➖ 利用分を引く
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setShowHistoryForCustomer(customerName);
                                                                        if (depositLogs.length === 0) fetchDepositLogs(customerName);
                                                                    }}
                                                                    className="flex-1 min-w-[100px] px-3 py-1.5 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded text-xs font-bold hover:bg-gray-100 dark:bg-gray-700 transition-colors whitespace-nowrap text-center">
                                                                    📜 履歴を見る
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}
                    </div> {/* END OF print:hidden wrapper */}

                    {/* 給与明細PDFプレビューモーダル */}
                    {selectedPdfStaff && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center py-10 overflow-auto print:static print:block print:p-0 print:bg-white print:overflow-visible">
                            <div className="bg-white dark:bg-gray-800 max-w-3xl w-full p-8 rounded-lg shadow-xl m-auto relative print:static print:p-0 print:m-0 print:shadow-none print:max-w-none">
                                <button onClick={() => setSelectedPdfStaff(null)} className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100 text-xl font-bold PrintHidden">✕</button>
                                <div id="pdf-content" className="space-y-6 text-black bg-white dark:bg-gray-800 print:bg-white print:text-black">
                                    <h2 className="text-2xl font-bold text-center border-b border-gray-800 pb-4 print:border-black">給与明細書</h2>

                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-xl font-bold border-b border-black pb-1 mb-2 inline-block min-w-[200px] print:border-black">{selectedPdfStaff} 様</p>
                                            <p className="text-sm font-medium">対象期間: {currentMonthStr.replace('-', '年')}月1日〜末日</p>
                                        </div>
                                        <div className="text-right text-sm">
                                            <p className="font-medium">発行日: {new Date().toLocaleDateString('ja-JP')}</p>
                                            <p className="font-bold text-gray-800 mt-1 text-base print:text-black">ハナシタラ.com</p>
                                        </div>
                                    </div>

                                    <table className="w-full text-sm border-collapse border border-gray-400">
                                        <thead>
                                            <tr className="bg-gray-100 text-center text-gray-800 print:bg-gray-100 print:text-black">
                                                <th className="border border-gray-400 py-2 px-2">日付</th>
                                                <th className="border border-gray-400 py-2 px-2">お客様名</th>
                                                <th className="border border-gray-400 py-2 px-2">サービス内訳</th>
                                                <th className="border border-gray-400 py-2 px-2">ご請求額 (売上)</th>
                                                <th className="border border-gray-400 py-2 px-2">スタッフ報酬</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {monthReports.filter(r => r.staff === selectedPdfStaff).map(r => (
                                                <tr key={r.id} className="text-center print:bg-white">
                                                    <td className="border border-gray-400 py-2 px-2 text-gray-700 print:text-black">{new Date(r.date).toLocaleDateString('ja-JP').slice(5)}</td>
                                                    <td className="border border-gray-400 py-2 px-2 text-gray-800 font-medium print:text-black">{r.customerName}</td>
                                                    <td className="border border-gray-400 py-2 px-2 text-xs text-gray-600 font-medium whitespace-pre-wrap text-left break-all max-w-[250px] print:text-black">{r.services.split(', ').join('\n')}</td>
                                                    <td className="border border-gray-400 py-2 px-2 text-gray-700 print:text-black">¥{r.totalSales.toLocaleString()}</td>
                                                    <td className="border border-gray-400 py-2 px-2 font-bold text-gray-900 print:text-black">¥{r.staffShare.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {monthReports.filter(r => r.staff === selectedPdfStaff).length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="border border-gray-400 py-8 text-center text-gray-500 dark:text-gray-400">
                                                        今月の実績はありません
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>

                                    <div className="flex justify-end pt-4">
                                        <div className="w-full max-w-[300px]">
                                            <div className="flex justify-between font-bold text-xl border-b-[3px] border-black pb-1 mb-2 print:border-black">
                                                <span>合計振込額</span>
                                                <span>¥{(staffStats.find(s => s.name === selectedPdfStaff)?.share || 0).toLocaleString()}</span>
                                            </div>
                                            <p className="text-xs text-gray-700 font-medium text-right print:text-black">※上記金額をご指定の口座へお振り込みいたします。</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-center gap-4 PrintHidden pt-4 border-t">
                                    <button onClick={() => window.print()} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700 transition flex items-center gap-2">
                                        🖨️ 印刷 / PDFで保存
                                    </button>
                                    <button onClick={() => setSelectedPdfStaff(null)} className="px-6 py-2.5 bg-gray-200 text-gray-800 dark:text-gray-200 rounded-lg font-bold shadow hover:bg-gray-300 transition">
                                        閉じる
                                    </button>
                                </div>
                            </div>
                            {/* 印刷用CSS */}
                            <style dangerouslySetInnerHTML={{
                                __html: `
                        @media print {
                            @page { size: auto; margin: 15mm; }
                            body { background-color: white !important; }
                            .PrintHidden { display: none !important; }
                        }
                    `}} />
                        </div>
                    )}
                    {/* スタッフ詳細モーダル */}
                    {showStaffDetailFor && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] PrintHidden pt-20">
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col mt-10">
                                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-xl">
                                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{showStaffDetailFor} さんの {selectedMonth.replace('-', '年')}月 実績詳細</h3>
                                    <button onClick={() => setShowStaffDetailFor(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:text-gray-200 text-xl font-bold">✕</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4">
                                    <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                                        <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                            <tr>
                                                <th className="px-4 py-2 border-b dark:border-gray-700">日付</th>
                                                <th className="px-4 py-2 border-b dark:border-gray-700">お客様名</th>
                                                <th className="px-4 py-2 border-b dark:border-gray-700 text-right">売上</th>
                                                <th className="px-4 py-2 border-b dark:border-gray-700 text-right">スタッフ報酬</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {monthReports.filter(r => r.staff === showStaffDetailFor).map(r => (
                                                <tr key={r.id} className="border-b dark:border-gray-700 hover:bg-gray-50/50 dark:bg-gray-800/50">
                                                    <td className="px-4 py-3">{new Date(r.date).toLocaleDateString('ja-JP').slice(5)}</td>
                                                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{r.customerName}</td>
                                                    <td className="px-4 py-3 text-right">¥{r.totalSales.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-indigo-700">¥{r.staffShare.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {monthReports.filter(r => r.staff === showStaffDetailFor).length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">この月の実績がありません</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* お客様履歴モーダル（デポジット + 業務報告） */}
                    {showHistoryForCustomer && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] PrintHidden pt-20">
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col mt-4">
                                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-xl">
                                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{showHistoryForCustomer} 様の ご利用履歴</h3>
                                    <button onClick={() => setShowHistoryForCustomer(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:text-gray-200 text-xl font-bold">✕</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 bg-gray-50/30">

                                    {/* 利用・売上履歴 (業務報告から抽出) */}
                                    <div>
                                        <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-1 inline-block">📞 過去のご利用・通話</h4>
                                        <div className="bg-white dark:bg-gray-800 rounded border shadow-sm overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                                                    <tr>
                                                        <th className="px-4 py-2">日付</th>
                                                        <th className="px-4 py-2">担当スタッフ</th>
                                                        <th className="px-4 py-2">利用サービス</th>
                                                        <th className="px-4 py-2 text-right">売上(請求額)</th>
                                                        <th className="px-4 py-2 text-center">入金状況</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reports.filter(r => r.customerName === showHistoryForCustomer)
                                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                        .map(r => (
                                                            <tr key={r.id} className="border-b dark:border-gray-700 hover:bg-gray-50/50 dark:bg-gray-800/50">
                                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{new Date(r.date).toLocaleDateString('ja-JP')}</td>
                                                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{r.staff}</td>
                                                                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{r.services}</td>
                                                                <td className="px-4 py-3 text-right font-bold text-gray-700 dark:text-gray-300">¥{r.totalSales.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                        {r.isPaid ? '入金済' : '未入金'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    {reports.filter(r => r.customerName === showHistoryForCustomer).length === 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">通話のご利用履歴がありません</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* デポジット履歴 */}
                                    <div>
                                        <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-1 inline-block">💰 デポジット（前払い）履歴</h4>
                                        <div className="bg-white dark:bg-gray-800 rounded border shadow-sm overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                                                    <tr>
                                                        <th className="px-4 py-2">日時</th>
                                                        <th className="px-4 py-2 text-center">操作</th>
                                                        <th className="px-4 py-2 text-right">増減額</th>
                                                        <th className="px-4 py-2 text-right">残高</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {depositLogs.filter(log => log.customerName === showHistoryForCustomer).map((log, i) => (
                                                        <tr key={i} className="border-b dark:border-gray-700 hover:bg-gray-50/50 dark:bg-gray-800/50">
                                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(log.date).toLocaleString('ja-JP')}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.type === 'チャージ' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                    {log.type}
                                                                </span>
                                                            </td>
                                                            <td className={`px-4 py-3 text-right font-bold ${log.type === 'チャージ' ? 'text-indigo-600' : 'text-orange-600'}`}>
                                                                {log.type === 'チャージ' ? '+' : '-'}¥{Math.abs(log.amount).toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-gray-200">¥{log.balance.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                    {depositLogs.filter(log => log.customerName === showHistoryForCustomer).length === 0 && (
                                                        <tr>
                                                            <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">デポジットの履歴がありません</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* 顧客追加モーダル */}
            {showAddCustomerModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddCustomerModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">新しい顧客を追加</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">お客様名</label>
                                <input
                                    type="text"
                                    value={newCustomerData.name}
                                    onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                    placeholder="山田 太郎"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">電話番号</label>
                                <input
                                    type="text"
                                    value={newCustomerData.phone}
                                    onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                    placeholder="090-1234-5678"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddCustomerModal(false)}
                                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={async () => {
                                    if (!newCustomerData.name || !newCustomerData.phone) {
                                        return alert('お客様名と電話番号は必須です');
                                    }
                                    try {
                                        setDeposits(prev => ({ ...prev, [newCustomerData.name]: 0 }));
                                        setCustomerPhones(prev => ({ ...prev, [newCustomerData.name]: newCustomerData.phone }));
                                        await fetch(GAS_URL, {
                                            method: 'POST',
                                            body: JSON.stringify({
                                                action: 'addCustomer',
                                                customerName: newCustomerData.name,
                                                customerPhone: newCustomerData.phone
                                            })
                                        });
                                        fetchDeposits();
                                        setNewCustomerData({ name: '', phone: '' });
                                        setShowAddCustomerModal(false);
                                    } catch (err) {
                                        console.error(err);
                                        alert('エラーが発生しました');
                                    }
                                }}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                            >
                                追加する
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* チャージモーダル */}
            {showChargeModal && chargeTarget && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowChargeModal(false); setChargeTarget(null); }}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">{chargeTarget}さんへチャージ</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">チャージ金額（円）</label>
                                <input
                                    type="number"
                                    value={chargeData.amount}
                                    onChange={(e) => setChargeData({ ...chargeData, amount: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
                                    placeholder="10000"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">還元率（%）</label>
                                <input
                                    type="number"
                                    value={chargeData.bonusRate}
                                    onChange={(e) => setChargeData({ ...chargeData, bonusRate: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
                                    placeholder="14"
                                />
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
                                <p className="text-sm text-green-700 dark:text-green-400">
                                    還元後の合計: <span className="font-bold">¥{(Number(chargeData.amount) * (1 + Number(chargeData.bonusRate) / 100)).toLocaleString()}</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => { setShowChargeModal(false); setChargeTarget(null); }}
                                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={async () => {
                                    if (!chargeData.amount || Number(chargeData.amount) <= 0) {
                                        return alert('有効な金額を入力してください');
                                    }
                                    try {
                                        const bonusAmount = Number(chargeData.amount) * (Number(chargeData.bonusRate) / 100);
                                        const totalAmount = Number(chargeData.amount) + bonusAmount;

                                        setDeposits(prev => ({ ...prev, [chargeTarget]: (prev[chargeTarget] || 0) + totalAmount }));

                                        await fetch(GAS_URL, {
                                            method: 'POST',
                                            body: JSON.stringify({
                                                action: 'addDeposit',
                                                customerName: chargeTarget,
                                                amount: totalAmount,
                                                rawAmount: Number(chargeData.amount),
                                                bonusRate: Number(chargeData.bonusRate)
                                            })
                                        });

                                        fetchDeposits();
                                        setChargeData({ amount: '', bonusRate: bonusRate.toString() });
                                        setShowChargeModal(false);
                                        setChargeTarget(null);
                                    } catch (err) {
                                        console.error(err);
                                        alert('エラーが発生しました');
                                    }
                                }}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors"
                            >
                                チャージする
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
