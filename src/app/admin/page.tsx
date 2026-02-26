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
}

export default function AdminDashboard() {
    const [reports, setReports] = useState<ReportData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorText, setErrorText] = useState('');

    // タブ状態管理
    const [activeTab, setActiveTab] = useState<'sales' | 'staff' | 'deposit'>('sales');
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


    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzopMne7Ga8ZruWAf3xvAP7WQFvQ-Uau09qsmG2K6-Mcs7xfrXXl1Ev4GmLHpOcgTwj/exec';

    // ②初回読み込み時に全データを取得する
    useEffect(() => {
        fetchReports();
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
                setCustomerPhones(json.phones || {});
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
                setBlacklistedPhones(json.phones || []);
            }
        } catch (err) {
            console.error('ブラックリスト取得エラー:', err);
        }
    };

    const fetchReports = async () => {
        setIsLoading(true);
        try {
            // GASの doGet 側を叩く (action=getReports)
            const res = await fetch(`${GAS_URL}?action=getReports`);
            const json = await res.json();

            if (json.success) {
                // 取得した二次元配列をオブジェクト形式に整形＋日数の計算
                const today = new Date();
                const formattedData: ReportData[] = json.data.map((row: any[]) => {
                    // A:ID(0), B:日付(1), C:スタッフ(2), D:顧客電話(3), E:顧客名(4), 
                    // F:提供サービス(5), G:総売上(6), H:スタッフ報酬(7), I:入金済(8)

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
                        staff: row[2],
                        customerPhone: row[3],
                        customerName: row[4],
                        services: row[5],
                        totalSales: Number(row[6]) || 0,
                        staffShare: Number(row[7]) || 0,
                        isPaid: isPaidStatus,
                        daysPending: days
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
            setIsLoading(false);
        }
    };

    const togglePaidStatus = async (id: string, currentPaid: boolean) => {
        const newPaidStatus = !currentPaid;
        // 画面上の見た目を即座に切り替える
        setReports(reports.map(r => r.id === id ? { ...r, isPaid: newPaidStatus } : r));

        try {
            // GASへ通信してスプレッドシートを更新
            await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'updatePaidStatus',
                    id: id,
                    isPaid: newPaidStatus
                }),
            });
        } catch (error) {
            console.error('更新エラー:', error);
            alert('通信エラーが発生しました。元の状態に戻ります。');
            // エラー時は画面を元に戻す
            setReports(reports.map(r => r.id === id ? { ...r, isPaid: currentPaid } : r));
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

    // フェーズ5: お客様一覧の生成（デポジット利用者優先＋その他のソート）
    const customerMap = new Map<string, { totalPaid: number, registeredDate: string }>();
    reports.forEach(r => {
        if (r.customerName) {
            const current = customerMap.get(r.customerName) || {
                totalPaid: 0,
                registeredDate: r.date
            };
            if (r.isPaid) {
                current.totalPaid += r.totalSales;
            }
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
        return {
            name: customer.name,
            phone,
            balance,
            totalPaid: customer.totalPaid,
            registeredDate: customer.registeredDate,
            customerNumber: index + 1
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

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8 pb-32">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b dark:border-gray-700 pb-4 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">オーナーダッシュボード</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">売上管理・スタッフ管理</p>
                </div>
            </header>

            {/* タブナビゲーション */}
            <div className="flex gap-4 border-b dark:border-gray-700 border-gray-100 dark:border-gray-700 mb-6">
                <button
                    onClick={() => setActiveTab('sales')}
                    className={`pb-3 px-4 text-sm font-bold transition-colors border-b-2 ${activeTab === 'sales' ? 'border-gray-900 text-gray-900 dark:text-gray-100' : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-600'
                        }`}
                >
                    📊 売上・入金管理
                </button>
                <button
                    onClick={() => setActiveTab('staff')}
                    className={`pb-3 px-4 text-sm font-bold transition-colors border-b-2 ${activeTab === 'staff' ? 'border-gray-900 text-gray-900 dark:text-gray-100' : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-600'
                        }`}
                >
                    👥 スタッフ管理
                </button>
                <button
                    onClick={() => setActiveTab('deposit')}
                    className={`pb-3 px-4 text-sm font-bold transition-colors border-b-2 ${activeTab === 'deposit' ? 'border-gray-900 text-gray-900 dark:text-gray-100' : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-600'
                        }`}
                >
                    💳 お客様管理
                </button>
            </div>

            {activeTab === 'sales' && (
                <>
                    {/* 集計サマリー表示 (フェーズ4) */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 総合サマリー */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-4 md:h-[280px]">
                            <div className="border-b dark:border-gray-700 border-gray-100 dark:border-gray-700 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <h2 className="font-bold text-gray-800 dark:text-gray-200">月間サマリー</h2>
                                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded">
                                    <span className="text-xs text-gray-600 dark:text-gray-400 font-bold whitespace-nowrap">表示月:</span>
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="text-sm font-bold bg-transparent dark:text-white dark:border-none focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">本日の売上</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">¥{totalTodaySales.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">今月の総売上</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">¥{totalMonthSales.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-blue-600 mb-1 font-bold">✨ 今月の運営利益</p>
                                    <p className="text-xl font-bold text-blue-600">¥{totalMonthProfit.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">今月の報酬合計</p>
                                    <p className="text-xl font-bold text-gray-700 dark:text-gray-300">¥{(totalMonthSales - totalMonthProfit).toLocaleString()}</p>
                                </div>
                                <div className="pt-2 border-t border-gray-100 dark:border-gray-700 col-span-2">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">現在の未入金</p>
                                    <p className="text-lg font-bold text-red-500">{unpaidCount}件 / ¥{totalUnpaid.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* 年間サマリー */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-4 relative overflow-hidden md:h-[280px]">
                            <div className="absolute top-0 right-0 p-4 opacity-5 text-6xl">📈</div>
                            <h2 className="font-bold border-b dark:border-gray-700 border-gray-100 dark:border-gray-700 pb-2 text-gray-800 dark:text-gray-200">確定申告用 ({currentYear}年 累計)</h2>
                            <div className="flex-1 flex flex-col justify-center gap-4 relative z-10">
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">年間 総売上</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">¥{totalYearSales.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-blue-600 mb-1 font-bold">年間 オーナー純利益</p>
                                    <p className="text-xl font-bold text-blue-600">¥{totalYearProfit.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* スタッフ別実績（今月） */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden h-full md:h-[280px]">
                            <div className="border-b dark:border-gray-700 border-gray-100 dark:border-gray-700 pb-2 mb-3 flex items-center justify-between">
                                <h2 className="font-bold text-gray-800 dark:text-gray-200">スタッフ別実績</h2>
                                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 flex items-center h-6 rounded font-bold">{selectedMonth.replace('-', '年')}月</span>
                            </div>
                            <div className="overflow-y-auto pr-2 space-y-3">
                                {staffStats.length === 0 ? (
                                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">データがありません</p>
                                ) : (
                                    <ul className="space-y-3">
                                        {staffStats.map(s => (
                                            <li key={s.name} className="flex justify-between items-center text-sm border-b dark:border-gray-700 border-gray-50 pb-2 last:border-0">
                                                <span className="font-semibold text-gray-700 dark:text-gray-300">{s.name}</span>
                                                <div className="text-right">
                                                    <p className="text-gray-900 dark:text-gray-100 font-medium">売上: ¥{s.sales.toLocaleString()}</p>
                                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">報酬: ¥{s.share.toLocaleString()}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* 報告データ一覧・入金チェック */}
                    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
                        <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                            <h2 className="font-semibold text-gray-800 dark:text-gray-200">最新の業務報告 / 入金確認</h2>
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
                                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">日付</th>
                                        <th className="px-6 py-3 font-medium">スタッフ</th>
                                        <th className="px-6 py-3 font-medium">お客様名 (電話) / サービス</th>
                                        <th className="px-6 py-3 font-medium text-right">売上額</th>
                                        <th className="px-6 py-3 font-medium text-right">スタッフ報酬</th>
                                        <th className="px-6 py-3 font-medium text-center">入金状況</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {reports.length === 0 && !isLoading && !errorText && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                                                報告データがまだありません
                                            </td>
                                        </tr>
                                    )}
                                    {reports.map((report) => {
                                        const isEditing = editingReportId === report.id;
                                        return (
                                            <tr key={report.id} className={`hover:bg-gray-50/50 dark:bg-gray-800/50 transition-colors ${!report.isPaid && report.daysPending >= 3 ? 'bg-red-50/30' : ''}`}>
                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(report.date).toLocaleDateString('ja-JP')}</td>
                                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{report.staff}</td>

                                                {isEditing ? (
                                                    <>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-2">
                                                                <input type="text" value={editReportData.customerName} onChange={e => setEditReportData({ ...editReportData, customerName: e.target.value })} className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs rounded focus:outline-none focus:border-b dark:border-gray-700lue-500" placeholder="お客様名" />
                                                                <input type="text" value={editReportData.customerPhone} onChange={e => setEditReportData({ ...editReportData, customerPhone: e.target.value })} className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs rounded focus:outline-none focus:border-b dark:border-gray-700lue-500" placeholder="電話番号" />
                                                                <div className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded inline-block mt-1">{report.services}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex flex-col items-end gap-1">
                                                                <div className="flex items-center gap-1"><span className="text-gray-500 dark:text-gray-400 font-bold">¥</span><input type="number" value={editReportData.totalSales} onChange={e => setEditReportData({ ...editReportData, totalSales: Number(e.target.value) })} className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs rounded w-24 text-right focus:outline-none focus:border-b dark:border-gray-700lue-500" /></div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-gray-400 dark:text-gray-500 text-[10px] font-bold">(※後で自動計算)</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col items-center gap-2">
                                                                <button onClick={async () => {
                                                                    setReports(reports.map(r => r.id === report.id ? { ...r, customerName: editReportData.customerName, customerPhone: editReportData.customerPhone, totalSales: editReportData.totalSales } : r));
                                                                    try {
                                                                        await fetch(GAS_URL, {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'text/plain' },
                                                                            body: JSON.stringify({ action: 'editReport', id: report.id, customerName: editReportData.customerName, customerPhone: editReportData.customerPhone, totalSales: editReportData.totalSales })
                                                                        });
                                                                        setEditingReportId(null);
                                                                        alert('保存しました。');
                                                                        fetchReports();
                                                                    } catch (err) { alert('エラーが発生しました。'); }
                                                                }} className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-700 w-full max-w-[100px]">一括保存</button>
                                                                <button onClick={() => setEditingReportId(null)} className="text-[10px] bg-gray-200 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded font-bold hover:bg-gray-300 w-full max-w-[100px]">キャンセル</button>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                                            <div className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                                                {report.customerName}
                                                                {blacklistedPhones.includes(report.customerPhone) && (
                                                                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-200 whitespace-nowrap">ブラックリスト</span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-2">
                                                                {report.customerPhone}
                                                                {!blacklistedPhones.includes(report.customerPhone) && (
                                                                    <button
                                                                        onClick={() => handleAddBlacklist(report.customerPhone, report.customerName)}
                                                                        className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-red-500 underline transition-colors whitespace-nowrap"
                                                                    >
                                                                        ブラックリスト登録
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded inline-block mt-1">{report.services}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-gray-100">¥{report.totalSales.toLocaleString()}</td>
                                                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">¥{report.staffShare.toLocaleString()}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col items-center gap-2">
                                                                <button
                                                                    onClick={() => togglePaidStatus(report.id, report.isPaid)}
                                                                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors border shadow-sm w-full max-w-[100px] ${report.isPaid
                                                                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:bg-gray-900'
                                                                        }`}
                                                                >
                                                                    {report.isPaid ? '✓ 入金済' : '未入金'}
                                                                </button>
                                                                {!report.isPaid && (
                                                                    <div className="flex flex-col items-center gap-1.5 w-full">
                                                                        {report.daysPending >= 3 && (
                                                                            <span className="text-[10px] text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded w-full text-center">3日経過!</span>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleCopyRemind(report)}
                                                                            className={`text-[10px] w-full max-w-[100px] py-1 border rounded transition-colors flex justify-center items-center ${copiedId === report.id ? 'bg-green-50 text-green-600 border-green-200' : 'border-b dark:border-gray-700lue-200 text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
                                                                        >
                                                                            {copiedId === report.id ? '✓ コピー完了' : '📝督促をコピー'}
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {/* 管理者用：修正ボタン */}
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingReportId(report.id);
                                                                        setEditReportData({
                                                                            customerName: report.customerName,
                                                                            customerPhone: report.customerPhone,
                                                                            totalSales: report.totalSales
                                                                        });
                                                                    }}
                                                                    className="text-[10px] w-full max-w-[100px] py-1 border rounded transition-colors flex justify-center items-center border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:bg-gray-900 mt-1"
                                                                >
                                                                    ✏️ 修正する
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!window.confirm(`この報告を完全に削除しますか？\n(復元できません)`)) return;
                                                                        setReports(reports.filter(r => r.id !== report.id));
                                                                        try {
                                                                            await fetch(GAS_URL, {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'text/plain' },
                                                                                body: JSON.stringify({ action: 'deleteReport', id: report.id })
                                                                            });
                                                                        } catch (err) { alert('エラーが発生しました。'); }
                                                                    }}
                                                                    className="text-[10px] w-full max-w-[100px] py-1 border rounded transition-colors flex justify-center items-center border-red-200 text-red-600 bg-red-50 hover:bg-red-100 mt-1"
                                                                >
                                                                    🗑️ 削除する
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
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
                    <div className="px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
                        <div className="flex items-center gap-3">
                            <h2 className="font-semibold text-gray-800 dark:text-gray-200">スタッフ管理</h2>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 text-xs focus:outline-none font-bold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 cursor-pointer"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="🔍 検索"
                                    className="border border-gray-200 dark:border-gray-700 pl-3 pr-2 py-1 text-xs rounded-full bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 w-28 focus:w-40 focus:outline-none focus:ring-1 focus:ring-gray-300 transition-all font-medium"
                                    value={staffSearchQuery}
                                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                                />
                            </div>
                            <select
                                value={staffSortOption}
                                onChange={(e) => setStaffSortOption(e.target.value as any)}
                                className="border-none bg-transparent text-gray-500 dark:text-gray-400 focus:outline-none font-medium text-[11px] cursor-pointer hover:text-gray-900 transition-colors"
                            >
                                <option value="sales_desc">売上順▼</option>
                                <option value="totalSales_desc">累計順▼</option>
                                <option value="name_asc">名前順▲</option>
                            </select>
                            <button
                                onClick={async () => {
                                    const name = window.prompt('追加するスタッフ名(※マイページのIDになります)を入力してください');
                                    if (!name) return;
                                    const password = window.prompt(`${name}さんの ログインパスワード を設定してください`);
                                    if (!password) return;
                                    const email = window.prompt(`${name}さんの 給与明細送信先メールアドレス を入力してください（任意）`) || '';

                                    try {
                                        await fetch(GAS_URL, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'text/plain' },
                                            body: JSON.stringify({ action: 'addStaff', name, password, email })
                                        });
                                        alert(`${name}さんを登録しました。マイページからIDとパスワードを利用してログイン可能です。`);
                                        setStaffEmails(prev => ({ ...prev, [name]: email })); // 即時UI反映
                                        fetchStaffList(); // リスト更新
                                    } catch (e) {
                                        alert('エラーが発生しました。');
                                    }
                                }}
                                className="px-3 py-1 ml-1 bg-[#1c1c1e] dark:bg-white text-white dark:text-[#1c1c1e] rounded-full text-xs font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-sm whitespace-nowrap">
                                ＋ 新規追加
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto relative p-6">
                        <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-3 font-medium">スタッフ名</th>
                                    <th className="px-6 py-3 font-medium text-right">今月の報酬額</th>
                                    <th className="px-6 py-3 font-medium text-right">累計の報酬額</th>
                                    <th className="px-6 py-3 font-medium text-center">操作・アクション</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {staffStats.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">データがありません</td>
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
                                                                await fetch(GAS_URL, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'text/plain' },
                                                                    body: JSON.stringify({
                                                                        action: 'sendEmail',
                                                                        to: toEmail,
                                                                        subject: `【ハナシタラ.com】${currentMonthStr.replace('-', '年')}月分 給与明細のお知らせ`,
                                                                        body: `${s.name} 様\n\nお疲れ様です。ハナシタラ.comです。\n${currentMonthStr.replace('-', '年')}月分の給与計算が完了いたしました。\n\n【合計振込額】: ¥${s.share.toLocaleString()}\n\n詳細はスタッフマイページにログインの上、PDFにてご確認ください。\n引き続きよろしくお願いいたします。`
                                                                    })
                                                                });
                                                                alert('メールを送信しました！');
                                                            } catch (e) {
                                                                alert('送信に失敗しました。');
                                                            }
                                                        }}
                                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-b dark:border-gray-700lue-200 rounded text-xs font-bold hover:bg-blue-100 transition-colors">
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

            {/* お客様デポジット管理タブ (フェーズ5用デモ) */}
            {activeTab === 'deposit' && (
                <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
                    <div className="px-5 py-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        <h2 className="font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">お客様管理</h2>

                        <div className="flex flex-wrap items-center gap-3 text-sm">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="🔍 名前・電話番号検索"
                                    className="border border-gray-200 dark:border-gray-700 pl-3 pr-2 py-1.5 rounded-full bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 w-44 focus:w-48 focus:outline-none focus:ring-1 focus:ring-gray-300 transition-all font-medium text-xs"
                                    value={customerSearchQuery}
                                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                />
                            </div>

                            <label className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 transition-colors mr-1">
                                <input
                                    type="checkbox"
                                    checked={showBlacklistOnly}
                                    onChange={(e) => setShowBlacklistOnly(e.target.checked)}
                                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 w-3.5 h-3.5"
                                />
                                <span className="text-[11px]">🚫 除外</span>
                            </label>

                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500 border-l border-r dark:border-gray-700 px-3">
                                <span title="前払いボーナス設定" className="text-sm">🎁</span>
                                <input type="number" value={bonusThreshold} onChange={e => setBonusThreshold(Number(e.target.value))} className="w-12 px-1 py-0.5 border dark:border-gray-700 rounded bg-transparent text-center focus:outline-none focus:border-gray-400 transition-colors" />
                                <span>円=</span>
                                <input type="number" value={bonusRate} onChange={e => setBonusRate(Number(e.target.value))} className="w-8 px-1 py-0.5 border dark:border-gray-700 rounded bg-transparent text-center focus:outline-none focus:border-gray-400 transition-colors" />
                                <span>%</span>
                                <button onClick={() => {
                                    localStorage.setItem('depositBonusThreshold', String(bonusThreshold));
                                    localStorage.setItem('depositBonusRate', String(bonusRate));
                                }} className="text-[10px] ml-1 text-gray-400 hover:text-indigo-500 font-bold transition-colors">保存</button>
                            </div>

                            <select
                                value={customerSortBy}
                                onChange={(e) => setCustomerSortBy(e.target.value as CustomerSortOption)}
                                className="border-none bg-transparent text-gray-500 dark:text-gray-400 focus:outline-none font-medium text-[11px] cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 transition-colors ml-1"
                            >
                                <option value="deposit">前払い有▼</option>
                                <option value="paid_desc">支払額▼</option>
                                <option value="registered_asc">登録古▲</option>
                                <option value="registered_desc">登録新▼</option>
                                <option value="number_asc">番号順▲</option>
                                <option value="name_asc">名前順▲</option>
                            </select>

                            <button
                                onClick={async () => {
                                    const name = window.prompt('新しいお客様名を入力してください');
                                    if (name) {
                                        const phone = window.prompt(`${name} 様の電話番号を入力してください（任意）`) || '';
                                        setDeposits(prev => ({ ...prev, [name]: 0 }));
                                        if (phone) setCustomerPhones(prev => ({ ...prev, [name]: phone }));

                                        try {
                                            await fetch(GAS_URL, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'text/plain' },
                                                body: JSON.stringify({ action: 'addCustomer', customerName: name, customerPhone: phone })
                                            });
                                        } catch (e) { console.error(e); }
                                    }
                                }}
                                className="px-3 py-1.5 ml-1 bg-[#1c1c1e] dark:bg-white text-white dark:text-[#1c1c1e] rounded-full text-xs font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-sm whitespace-nowrap">
                                ＋ 新規追加
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto relative p-6">
                        <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-3 font-medium">No.</th>
                                    <th className="px-6 py-3 font-medium">お客様名</th>
                                    <th className="px-6 py-3 font-medium">登録日</th>
                                    <th className="px-6 py-3 font-medium text-right">累計支払額</th>
                                    <th className="px-6 py-3 font-medium text-right">現在の前払い残高</th>
                                    <th className="px-6 py-3 font-medium text-center">操作・アクション</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {customerList.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                                            データがありません。右下の「新規のお客様を追加」からお試しください。
                                        </td>
                                    </tr>
                                ) : (
                                    customerList.map(({ name: customerName, phone, balance, totalPaid, registeredDate, customerNumber }) => (
                                        <tr key={customerName} className={`transition-colors ${balance > 0 ? 'bg-indigo-50/50' : 'hover:bg-gray-50/50 dark:bg-gray-800/50'}`}>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-gray-400 dark:text-gray-500 font-medium">{customerNumber}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingCustomerName === customerName ? (
                                                    <div className="flex flex-col gap-2 w-48">
                                                        <input type="text" value={editCustomerData.customerName} onChange={e => setEditCustomerData({ ...editCustomerData, customerName: e.target.value })} className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs rounded focus:outline-none focus:border-indigo-500" placeholder="お客様名" />
                                                        <input type="text" value={editCustomerData.customerPhone} onChange={e => setEditCustomerData({ ...editCustomerData, customerPhone: e.target.value })} className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs rounded focus:outline-none focus:border-indigo-500" placeholder="電話番号" />
                                                        <div className="flex gap-2">
                                                            <button onClick={async () => {
                                                                try {
                                                                    setEditingCustomerName(null);
                                                                    await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'editCustomer', oldName: customerName, newName: editCustomerData.customerName, phone: editCustomerData.customerPhone }) });
                                                                    fetchDeposits();
                                                                    fetchReports();
                                                                    alert('お客様情報を更新しました。');
                                                                } catch (e) { alert('エラーが発生しました。'); }
                                                            }} className="text-[10px] bg-indigo-600 text-white font-bold px-3 py-1 rounded shadow-sm hover:bg-indigo-700">保存</button>
                                                            <button onClick={() => setEditingCustomerName(null)} className="text-[10px] bg-gray-200 text-gray-700 dark:text-gray-300 font-bold px-3 py-1 rounded shadow-sm hover:bg-gray-300">キャンセル</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-gray-900 dark:text-gray-100">{customerName}</span>
                                                            {blacklistedPhones.includes(phone) && phone && phone !== '登録なし' && (
                                                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-200 whitespace-nowrap">ブラックリスト</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] text-gray-400 dark:text-gray-500">{phone}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                                                    {new Date(registeredDate).toLocaleDateString('ja-JP')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-gray-600 dark:text-gray-400 font-medium">¥{totalPaid.toLocaleString()}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className={`font-bold ${balance > 0 ? 'text-indigo-600' : 'text-gray-400 dark:text-gray-500'}`}>¥{balance.toLocaleString()}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-2">
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
                                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingCustomerName(customerName);
                                                                setEditCustomerData({ customerName: customerName, customerPhone: phone === '登録なし' ? '' : phone });
                                                            }}
                                                            className="flex-1 min-w-[100px] px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded text-xs font-bold hover:bg-gray-50 dark:bg-gray-900 transition-colors whitespace-nowrap text-center">
                                                            ✏️ 設定変更
                                                        </button>
                                                        {!blacklistedPhones.includes(phone) && phone !== '登録なし' && phone && (
                                                            <button
                                                                onClick={() => handleAddBlacklist(phone, customerName)}
                                                                className="flex-1 min-w-[100px] px-3 py-1.5 bg-white dark:bg-gray-800 text-red-500 border border-red-200 rounded text-xs font-bold hover:bg-red-50 transition-colors whitespace-nowrap text-center">
                                                                🚫 ブラックリスト登録
                                                            </button>
                                                        )}
                                                    </div>
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

            {/* 給与明細PDFプレビューモーダル */}
            {selectedPdfStaff && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center py-10 overflow-auto">
                    <div className="bg-white dark:bg-gray-800 max-w-3xl w-full p-8 rounded-lg shadow-xl m-auto relative">
                        <button onClick={() => setSelectedPdfStaff(null)} className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100 text-xl font-bold PrintHidden">✕</button>
                        <div id="pdf-content" className="space-y-6 text-black bg-white dark:bg-gray-800">
                            <h2 className="text-2xl font-bold text-center border-b dark:border-gray-700 border-gray-800 pb-4">給与明細書</h2>

                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-xl font-bold border-b dark:border-gray-700 border-b dark:border-gray-700lack pb-1 mb-2 inline-block min-w-[200px]">{selectedPdfStaff} 様</p>
                                    <p className="text-sm font-medium">対象期間: {currentMonthStr.replace('-', '年')}月1日〜末日</p>
                                </div>
                                <div className="text-right text-sm">
                                    <p className="font-medium">発行日: {new Date().toLocaleDateString('ja-JP')}</p>
                                    <p className="font-bold text-gray-800 dark:text-gray-200 mt-1 text-base">ハナシタラ.com</p>
                                </div>
                            </div>

                            <table className="w-full text-sm border-collapse border border-gray-400">
                                <thead>
                                    <tr className="bg-gray-100 dark:bg-gray-700 text-center text-gray-800 dark:text-gray-200">
                                        <th className="border border-gray-400 py-2 px-2">日付</th>
                                        <th className="border border-gray-400 py-2 px-2">お客様名</th>
                                        <th className="border border-gray-400 py-2 px-2">サービス内訳</th>
                                        <th className="border border-gray-400 py-2 px-2">ご請求額 (売上)</th>
                                        <th className="border border-gray-400 py-2 px-2">スタッフ報酬</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthReports.filter(r => r.staff === selectedPdfStaff).map(r => (
                                        <tr key={r.id} className="text-center hover:bg-gray-50/50 dark:bg-gray-800/50">
                                            <td className="border border-gray-400 py-2 px-2 text-gray-700 dark:text-gray-300">{new Date(r.date).toLocaleDateString('ja-JP').slice(5)}</td>
                                            <td className="border border-gray-400 py-2 px-2 text-gray-800 dark:text-gray-200 font-medium">{r.customerName}</td>
                                            <td className="border border-gray-400 py-2 px-2 text-xs text-gray-600 dark:text-gray-400 font-medium whitespace-pre-wrap text-left break-all max-w-[250px]">{r.services.split(', ').join('\n')}</td>
                                            <td className="border border-gray-400 py-2 px-2 text-gray-700 dark:text-gray-300">¥{r.totalSales.toLocaleString()}</td>
                                            <td className="border border-gray-400 py-2 px-2 font-bold text-gray-900 dark:text-gray-100">¥{r.staffShare.toLocaleString()}</td>
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
                                    <div className="flex justify-between font-bold text-xl border-b-[3px] border-b dark:border-gray-700lack pb-1 mb-2">
                                        <span>合計振込額</span>
                                        <span>¥{(staffStats.find(s => s.name === selectedPdfStaff)?.share || 0).toLocaleString()}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium text-right">※上記金額をご指定の口座へお振り込みいたします。</p>
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
                            body * { visibility: hidden !important; }
                            #pdf-content, #pdf-content * { visibility: visible !important; }
                            #pdf-content { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
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
    );
}
