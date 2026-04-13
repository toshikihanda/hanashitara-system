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
    depositUsed: number; // デポジット使用額
    billingAmount: number; // 請求額
    memo?: string; // メモ・備考
}

export default function AdminDashboard() {
    const [reports, setReports] = useState<ReportData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [savingMessage, setSavingMessage] = useState<string | null>(null);
    const [errorText, setErrorText] = useState('');
    const [staffMasterSet, setStaffMasterSet] = useState<Set<string>>(new Set());

    // タブ状態管理
    const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'staff' | 'customers' | 'deposit'>('dashboard');
    const [reportSearchQuery, setReportSearchQuery] = useState('');
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [staffSortOption, setStaffSortOption] = useState<'sales_desc' | 'totalSales_desc' | 'name_asc'>('sales_desc');
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [showBlacklistOnly, setShowBlacklistOnly] = useState(false);
    const [showDepositOnly, setShowDepositOnly] = useState(false);
    // 未入金フィルタ状態（ダッシュボードからの遷移用）
    const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
    // 入金済みにしたばかりのID（未入金フィルタ中でも一時的に表示を維持するため）
    const [recentlyPaidIds, setRecentlyPaidIds] = useState<Set<string>>(new Set());
    // ボーナス設定状態
    const [bonusThreshold, setBonusThreshold] = useState(5000);
    const [bonusRate, setBonusRate] = useState(14);
    // PDFプレビュー用状態
    const [selectedPdfStaff, setSelectedPdfStaff] = useState<string | null>(null);
    // 前払いデポジット状態と顧客電話番号
    const [deposits, setDeposits] = useState<Record<string, number>>({});
    const [customerPhones, setCustomerPhones] = useState<Record<string, string>>({});
    // スタッフのメアド保持用・対応サービス保持用・パスワード保持用
    const [staffEmails, setStaffEmails] = useState<Record<string, string>>({});
    const [staffServices, setStaffServices] = useState<Record<string, string>>({});
    const [staffPasswords, setStaffPasswords] = useState<Record<string, string>>({});
    // 顧客パスワード保持用（マイページログイン用）
    const [customerPasswords, setCustomerPasswords] = useState<Record<string, string>>({});
    // 顧客登録日保持用（電話番号キー）
    const [customerRegisterDatesByPhone, setCustomerRegisterDatesByPhone] = useState<Record<string, string>>({});
    // 顧客リスト(name→正規化済み電話番号) の権威マップ。前払い管理/業務報告と食い違う場合の照合用
    const [listPhoneByName, setListPhoneByName] = useState<Record<string, string>>({});

    type CustomerSortOption = 'deposit' | 'paid_desc' | 'registered_asc' | 'registered_desc' | 'name_asc' | 'number_asc' | 'balance_desc' | 'monthly_amount_desc' | 'call_count_desc';
    const [customerSortBy, setCustomerSortBy] = useState<CustomerSortOption>('registered_desc');

    // コピー完了アニメーション表示用
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // ブラックリスト保持用
    const [blacklistedPhones, setBlacklistedPhones] = useState<string[]>([]);

    const currentYearDefault = new Date().getFullYear();
    const currentMonthStrDefault = `${currentYearDefault}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState(currentMonthStrDefault);
    const [showMonthPicker, setShowMonthPicker] = useState(false); // 年月ドロップダウン表示用
    const [trendOffset, setTrendOffset] = useState(0); // グラフスライド用オフセット
    const [trendMonths, setTrendMonths] = useState<6 | 12>(6); // 売上推移の表示期間（6ヶ月 or 12ヶ月）

    // 履歴モーダル・スタッフ詳細用
    const [depositLogs, setDepositLogs] = useState<any[]>([]);
    const [showHistoryForCustomer, setShowHistoryForCustomer] = useState<string | null>(null);
    const [showStaffDetailFor, setShowStaffDetailFor] = useState<string | null>(null);
    const [historyTabMode, setHistoryTabMode] = useState<'detail' | 'ledger'>('detail');

    // インライン編集用ステート
    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [editReportData, setEditReportData] = useState<{ customerName: string, customerPhone: string, totalSales: number }>({ customerName: '', customerPhone: '', totalSales: 0 });

    const [editingStaffName, setEditingStaffName] = useState<string | null>(null);
    const [editStaffData, setEditStaffData] = useState<{ name: string, password: string, email: string, services: string[] }>({ name: '', password: '', email: '', services: [] });

    const [editingCustomerName, setEditingCustomerName] = useState<string | null>(null);
    const [editCustomerData, setEditCustomerData] = useState<{ customerName: string, customerPhone: string, customerPassword: string }>({ customerName: '', customerPhone: '', customerPassword: '' });
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 顧客追加・チャージ用モーダルステート
    const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
    const [showChargeModal, setShowChargeModal] = useState(false);
    const [chargeTarget, setChargeTarget] = useState<string | null>(null);
    const [chargeTargetPhone, setChargeTargetPhone] = useState<string | null>(null);
    const [newCustomerData, setNewCustomerData] = useState({ name: '', phone: '', password: '' });
    const [chargeData, setChargeData] = useState({ amount: '', bonusRate: bonusRate.toString() });

    // スタッフ追加モーダル用ステート
    const [showAddStaffModal, setShowAddStaffModal] = useState(false);
    const [newStaffData, setNewStaffData] = useState<{ name: string, password: string, email: string, services: string[] }>({ name: '', password: '', email: '', services: [] });

    // トースト通知用ステート
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbzhzZLoVQRSYYykqnu88ebBtx79htz-3A7YDa3RgBKbjYJ-ie308nsQXhJflpEnNfuz0g/exec';

    // JST日付文字列を安全にフォーマットするヘルパー
    // GASから「yyyy/MM/dd HH:mm:ss」形式で来る想定。Date型や旧形式にも対応
    const formatJSTDate = (dateStr: string | Date, withTime = false): string => {
        if (!dateStr) return '';
        const s = String(dateStr);
        // 既にyyyy/MM/dd形式ならそのまま使う
        if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(s)) {
            return withTime ? s : s.split(' ')[0];
        }
        // それ以外はDateオブジェクト化してJSTフォーマット
        const d = new Date(s);
        if (isNaN(d.getTime())) return s;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        if (!withTime) return `${y}/${m}/${day}`;
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${y}/${m}/${day} ${h}:${min}`;
    };

    // オーナー判定（オーナーの売上は全額がシステム利益になる）
    const isOwnerStaff = (staffName: string) => staffName === '吉川（オーナー）';

    // レポートからオーナー取り分（システム利益）を計算
    const getProfit = (r: { staff: string, totalSales: number, staffShare: number }) => {
        return isOwnerStaff(r.staff) ? r.totalSales : (r.totalSales - r.staffShare);
    };

    // 電話番号を正規化（ハイフン、スペース、先頭のシングルクォート、カッコなどを除去して数字のみにする）
    const normalizePhone = (phone: string) => {
        let p = String(phone || '').replace(/^'/, '').replace(/[-\s()（）]/g, '');
        // スプレッドシートの仕様で先頭の0が落ちている場合への対策
        if (p && !p.startsWith('0')) {
            p = '0' + p;
        }
        return p;
    };

    // 電話番号を表示用にフォーマット（XXX-XXXX-XXXX形式に変換）
    const formatPhone = (phone: string) => {
        const normalized = normalizePhone(phone);
        if (normalized.length === 11) {
            return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
        } else if (normalized.length === 10) {
            return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
        }
        return phone; // そのまま返す
    };

    // ②初回読み込み時に全データを取得する
    useEffect(() => {
        fetchReports(true);
        fetchBlacklist();
        fetchDeposits();
        fetchStaffList();
        fetchCustomerInfo();

        // ボーナス設定の読み込み
        const savedThreshold = localStorage.getItem('depositBonusThreshold');
        const savedRate = localStorage.getItem('depositBonusRate');
        if (savedThreshold) setBonusThreshold(Number(savedThreshold));
        if (savedRate) setBonusRate(Number(savedRate));
    }, []);

    // ③定期的なデータ更新（30秒ごと）
    useEffect(() => {
        const interval = setInterval(() => {
            fetchReports(false); // ローディング表示なしで更新
            fetchDeposits();
        }, 30000); // 30秒ごと

        return () => clearInterval(interval);
    }, []);

    // ④ページがフォーカスされたときにデータを更新
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                // ページが表示されたときにデータを更新
                fetchReports(false);
                fetchDeposits();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleVisibilityChange);
        };
    }, []);

    const fetchStaffList = async () => {
        try {
            const res = await fetch(`${GAS_URL}?action=getStaffList&_=${Date.now()}`);
            const json = await res.json();
            if (json.success && json.staff) {
                const emails: Record<string, string> = {};
                const servicesMap: Record<string, string> = {};
                const passwords: Record<string, string> = {};
                const masterNames = new Set<string>();
                json.staff.forEach((s: any) => {
                    const name = String(s.name || '').trim();
                    if (!name) return;
                    masterNames.add(name);
                    emails[name] = s.email;
                    servicesMap[name] = s.services || '';
                    passwords[name] = s.password || '';
                });
                setStaffEmails(emails);
                setStaffServices(servicesMap);
                setStaffPasswords(passwords);
                setStaffMasterSet(masterNames);
            }
        } catch (err) {
            console.error('スタッフ取得エラー:', err);
        }
    };

    const fetchDeposits = async () => {
        try {
            const res = await fetch(`${GAS_URL}?action=getDeposits&_=${Date.now()}`);
            const json = await res.json();
            if (json.success) {
                setDeposits(json.deposits || {});
                const safePhones: Record<string, string> = {};
                const safePasswords: Record<string, string> = {};
                const safeRegisterDates: Record<string, string> = {};
                
                for (const [k, v] of Object.entries(json.phones || {})) {
                    safePhones[String(k).trim()] = String(v).trim().replace(/^'/, '');
                }
                for (const [k, v] of Object.entries(json.passwords || {})) {
                    safePasswords[String(k).trim()] = String(v);
                }
                for (const [k, v] of Object.entries(json.registerDatesByPhone || {})) {
                    safeRegisterDates[String(k).trim()] = String(v);
                }

                setCustomerPhones(safePhones);
                setCustomerPasswords(safePasswords);
                setCustomerRegisterDatesByPhone(safeRegisterDates);
            }
        } catch (err) {
            console.error('デポジット取得エラー:', err);
        }
    };

    const fetchDepositLogs = async () => {
        try {
            const res = await fetch(`${GAS_URL}?action=getDepositHistory&_=${Date.now()}`);
            const json = await res.json();
            if (json.success && json.history) {
                setDepositLogs(json.history);
            }
        } catch (err) {
            console.error('履歴取得エラー:', err);
        }
    };

    const fetchBlacklist = async () => {
        try {
            const res = await fetch(`${GAS_URL}?action=getBlacklistPhones&_=${Date.now()}`);
            const json = await res.json();
            if (json.success) {
                const safeBlacklist = (json.phones || []).map((p: any) => normalizePhone(String(p).trim()));
                setBlacklistedPhones(safeBlacklist);
            }
        } catch (err) {
            console.error('ブラックリスト取得エラー:', err);
        }
    };

    // 顧客リストから name→phone の権威マップを構築（前払い管理・業務報告と電話番号が食い違う場合の真の参照元）
    const fetchCustomerInfo = async () => {
        try {
            const res = await fetch(`${GAS_URL}?action=getCustomerInfo&_=${Date.now()}`);
            const json = await res.json();
            if (json.success && json.customers) {
                const map: Record<string, string> = {};
                for (const [phone, name] of Object.entries(json.customers)) {
                    const normPhone = normalizePhone(String(phone));
                    const nm = String(name).trim();
                    if (nm && normPhone && !map[nm]) map[nm] = normPhone;
                }
                setListPhoneByName(map);
            }
        } catch (err) {
            console.error('顧客リスト取得エラー:', err);
        }
    };

    const fetchReports = async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        try {
            // GASの doGet 側を叩く (action=getReports)
            const res = await fetch(`${GAS_URL}?action=getReports&_=${Date.now()}`);
            const json = await res.json();

            if (json.success) {
                // 取得した二次元配列をオブジェクト形式に整形＋日数の計算
                const today = new Date();
                const formattedData: ReportData[] = json.data.map((row: any[]) => {
                    // A:ID(0), B:日付(1), C:スタッフ(2), D:顧客電話(3), E:顧客名(4),
                    // F:提供サービス(5), G:総売上(6), H:スタッフ報酬(7), I:入金済(8), J:入金日(9),
                    // K:デポジット使用額(10), L:請求額(11)

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
                        staff: String(row[2] || '').trim(),
                        customerPhone: String(row[3] || '').trim().replace(/^'/, ''),
                        customerName: String(row[4] || '').trim(),
                        services: String(row[5] || ''),
                        totalSales: Number(row[6]) || 0,
                        staffShare: Number(row[7]) || 0,
                        isPaid: isPaidStatus,
                        daysPending: days,
                        paymentDate: row[9] ? String(row[9]) : undefined,
                        depositUsed: Number(row[10]) || 0,
                        billingAmount: Number(row[11]) || 0,
                        memo: String(row[12] || '')
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

        // 画面上の見た目を即座に切り替える（関数型更新で最新stateを参照）
        setReports(prev => prev.map(r => r.id === id ? { ...r, isPaid: newPaidStatus, paymentDate } : r));

        // 未入金フィルタ中に入金済みにした場合、一時的にリストに残す
        if (showUnpaidOnly && newPaidStatus) {
            setRecentlyPaidIds(prev => new Set(prev).add(id));
            setTimeout(() => {
                setRecentlyPaidIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }, 1500);
        }

        setIsSaving(true);
        try {
            // GASへ通信してスプレッドシートを更新
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'updatePaidStatus',
                    id: id,
                    isPaid: newPaidStatus,
                    paymentDate: paymentDate
                }),
            });
            const result = await res.json();
            if (!result.success) {
                throw new Error(result.message || '更新に失敗しました');
            }
            // 入金確認時にスタッフへメール通知済みの場合トースト表示
            if (newPaidStatus && result.emailSent) {
                setToastMessage('入金確認しました（スタッフにメール通知済み）');
                setTimeout(() => setToastMessage(null), 3000);
            }
        } catch (error) {
            console.error('更新エラー:', error);
            alert('通信エラーが発生しました。元の状態に戻ります。');
            // エラー時は画面を元に戻す（関数型更新）
            setReports(prev => prev.map(r => r.id === id ? { ...r, isPaid: currentPaid, paymentDate: undefined } : r));
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddBlacklist = async (phone: string, name: string) => {
        const normalizedPhone = normalizePhone(phone);
        const reason = window.prompt(`${name}さん (${formatPhone(phone)}) をブラックリストに登録する理由を入力してください（イタズラ、未払い等）`);
        if (!reason) return; // キャンセル

        // 即座にUIへ反映（正規化した電話番号で保存）
        setBlacklistedPhones(prev => [...prev, normalizedPhone]);

        setIsSaving(true);
        try {
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'addBlacklist', phone: normalizedPhone, name, reason }),
            });
            const result = await res.json();
            const emailCount = result.emailsSent || 0;
            alert(`ブラックリストに登録しました。${emailCount > 0 ? `\n全スタッフ（${emailCount}名）にメール通知しました。` : ''}`);
        } catch (err) {
            console.error('ブラックリスト登録エラー:', err);
            alert('通信エラーが発生しました。時間を置いて再度お試しください。');
            // エラー時は元に戻す
            setBlacklistedPhones(prev => prev.filter(p => p !== normalizedPhone));
        } finally {
            setIsSaving(false);
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
        // "-> 計算〇分" などの部分を削除
        const cleanedService = serviceName.replace(/\s*->\s*.*/, '');
        const match = cleanedService.match(/^(.+?)\((\d+)分/);
        if (match) {
            return `${match[1]} ${match[2]}分`;
        }
        return cleanedService;
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
    const totalYearProfit = yearReports.reduce((sum, r) => sum + getProfit(r), 0);

    // 1.1. 年単位の売上推移データ（全年度）
    const yearlyStatsMap = new Map<number, { sales: number, profit: number }>();
    reports.forEach(r => {
        const y = new Date(r.date).getFullYear();
        const current = yearlyStatsMap.get(y) || { sales: 0, profit: 0 };
        current.sales += r.totalSales;
        current.profit += getProfit(r);
        yearlyStatsMap.set(y, current);
    });
    const yearlyStats = Array.from(yearlyStatsMap.entries())
        .map(([year, data]) => ({ year, ...data }))
        .sort((a, b) => a.year - b.year)
        .slice(-6); // 直近6年分のみ表示
    const maxYearlySales = Math.max(...yearlyStats.map(d => Math.max(d.sales, d.profit)), 1);

    // 1.5. 本日の売上（当日）
    const todayStr = new Date().toLocaleDateString('ja-JP');
    const todayReports = reports.filter(r => new Date(r.date).toLocaleDateString('ja-JP') === todayStr);
    const totalTodaySales = todayReports.reduce((sum, r) => sum + r.totalSales, 0);

    // 2. 今月分合計
    const monthReports = reports.filter(r => {
        const d = new Date(r.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === currentMonthStr;
    }).sort((a, b) => {
        // 3日以上経過した未入金報告を最優先で上に表示
        const aUrgent = !a.isPaid && a.daysPending >= 3;
        const bUrgent = !b.isPaid && b.daysPending >= 3;

        if (aUrgent && !bUrgent) return -1; // aを上に
        if (!aUrgent && bUrgent) return 1;  // bを上に

        // それ以外は新しい報告を上に表示（降順）
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    const totalMonthSales = monthReports.reduce((sum, r) => sum + r.totalSales, 0);
    const totalMonthProfit = monthReports.reduce((sum, r) => sum + getProfit(r), 0);

    // 3. 全ての未入金額・件数
    const unpaidReports = reports.filter(r => !r.isPaid);
    const totalUnpaid = unpaidReports.reduce((sum, r) => sum + r.totalSales, 0);
    const unpaidCount = unpaidReports.length;

    // 4. スタッフ別集計（今月 ＋ 累計）- スタッフマスターに存在する人のみ
    const staffStatsMap = new Map<string, { sales: number, share: number, totalSales: number, totalShare: number }>();

    // スタッフマスターに登録されているスタッフのみ初期化（売上0でも表示させるため）
    const activeStaffNames = staffMasterSet.size > 0 ? staffMasterSet : new Set(Object.keys(staffEmails));
    activeStaffNames.forEach(name => {
        staffStatsMap.set(name, { sales: 0, share: 0, totalSales: 0, totalShare: 0 });
    });

    // まず全期間で累計を計算（マスターに存在するスタッフのみ）
    reports.forEach(r => {
        if (staffMasterSet.size > 0 && !staffMasterSet.has(r.staff)) return;
        const current = staffStatsMap.get(r.staff) || { sales: 0, share: 0, totalSales: 0, totalShare: 0 };
        staffStatsMap.set(r.staff, {
            ...current,
            totalSales: current.totalSales + r.totalSales,
            totalShare: current.totalShare + r.staffShare
        });
    });

    // 次に今月分を計算（マスターに存在するスタッフのみ）
    monthReports.forEach(r => {
        if (staffMasterSet.size > 0 && !staffMasterSet.has(r.staff)) return;
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

    // フェーズ6: 売上推移（直近N ヶ月、スライド機能付き）
    const trendData = [];
    if (selectedMonth) {
        const baseDate = new Date(`${selectedMonth}-01`);
        // trendOffsetを使用してスライド位置を調整（0なら現在月基準）
        for (let i = trendMonths - 1; i >= 0; i--) {
            const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i + trendOffset, 1);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const monthKey = `${yyyy}-${mm}`;

            const mReports = reports.filter(r => {
                const rd = new Date(r.date);
                return rd.getFullYear() === yyyy && String(rd.getMonth() + 1).padStart(2, '0') === mm;
            });

            const mSales = mReports.reduce((sum, r) => sum + r.totalSales, 0);
            const mProfit = mReports.reduce((sum, r) => sum + getProfit(r), 0);

            trendData.push({
                monthStr: `${d.getMonth() + 1}月`,
                fullMonth: monthKey,
                sales: mSales,
                profit: mProfit
            });
        }
    }
    const maxTrendSales = Math.max(...trendData.map(d => Math.max(d.sales, d.profit)), 1);

    // フェーズ5: お客様一覧の生成（電話番号をキーにすることで同姓同名を別人として扱う）
    type CustomerMapEntry = {
        name: string;
        phoneKey: string;    // 正規化済み（重複判定・ソース照合用）
        phoneDisplay: string; // 生の電話番号（表示用）
        totalPaid: number;
        registeredDate: string;
    };
    const customerMap = new Map<string, CustomerMapEntry>();

    reports.forEach(r => {
        const cName = r.customerName.trim();
        if (!cName) return;
        const rawPhone = String(r.customerPhone || '').replace(/^'/, '');
        const reportPhone = normalizePhone(rawPhone);
        // 同姓同名を別人として区別するため、電話番号を主キーにする。電話番号が無い古い報告だけ名前にフォールバック。
        const key = reportPhone || cName;

        // 登録日の参照優先順位（同姓同名を正しく区別するため "電話番号の直接一致" を最優先）:
        //  ① 業務報告の電話番号で直接ヒット … 同姓同名でもこの顧客固有の電話番号で正しく取得できる
        //  ② 前払い管理側の電話番号（customerPhones）
        //  ③ 顧客リスト側 name→phone (listPhoneByName) … 上記のどちらも番号が食い違っているときの最終救済
        const canonicalPhone = normalizePhone(customerPhones[cName] || '');
        const authoritativePhone = listPhoneByName[cName] || '';
        const listRegDate =
            customerRegisterDatesByPhone[reportPhone] ||
            customerRegisterDatesByPhone[canonicalPhone] ||
            customerRegisterDatesByPhone[authoritativePhone] ||
            '';

        const current = customerMap.get(key) || {
            name: cName,
            phoneKey: reportPhone,
            phoneDisplay: rawPhone || customerPhones[cName] || '',
            totalPaid: 0,
            registeredDate: listRegDate || r.date
        };
        // 報告がある＝利用があったとみなし、isPaidに関わらず累計売上に加算する
        current.totalPaid += r.totalSales;

        if (listRegDate) {
            // 顧客リスト側の登録日を常に正として上書き（業務報告の日付で汚染されないようにする）
            current.registeredDate = listRegDate;
        } else {
            // リスト側に登録日がない場合のみ、より古い報告日を探す
            const rDateObj = new Date(r.date);
            const currentRegDateObj = new Date(current.registeredDate);
            if (!isNaN(rDateObj.getTime()) && rDateObj < currentRegDateObj) {
                current.registeredDate = r.date;
            }
        }
        customerMap.set(key, current);
    });

    // 業務報告が一度も無い顧客（前払いのみ等）を追加
    Object.keys(deposits).forEach(name => {
        const cName = name.trim();
        const rawPhone = customerPhones[cName] || '';
        const phoneKey = normalizePhone(rawPhone);
        const key = phoneKey || cName;
        if (customerMap.has(key)) return;
        // 業務報告側の電話番号と顧客リスト側の電話番号が食い違っている場合の重複エントリ防止
        // 既に同じ名前の顧客が存在していれば、こちら側の情報（電話番号）を合流させる
        const existing = Array.from(customerMap.values()).find(c => c.name === cName);
        if (existing) {
            // 顧客リスト側の登録日があり、まだ反映されていなければ上書き
            const listRegDate = customerRegisterDatesByPhone[phoneKey];
            if (listRegDate) existing.registeredDate = listRegDate;
            return;
        }
        customerMap.set(key, {
            name: cName,
            phoneKey,
            phoneDisplay: rawPhone,
            totalPaid: 0,
            registeredDate: customerRegisterDatesByPhone[phoneKey] || new Date().toISOString()
        });
    });

    // 登録日ベースでお客様番号（連番）を割り当てるために一時ソート
    // depositsにもcustomerPhonesにも存在しない顧客は削除済みとみなして除外
    const allCustomers = Array.from(customerMap.values())
        .filter(c => deposits[c.name] !== undefined || customerPhones[c.name] !== undefined)
        .sort((a, b) => new Date(a.registeredDate).getTime() - new Date(b.registeredDate).getTime());

    const customerList = allCustomers.map((customer, index) => {
        const balance = deposits[customer.name] || 0;
        const phone = customer.phoneDisplay || customerPhones[customer.name] || '登録なし';

        // 通話回数・今月の利用額は電話番号で絞り込み（同姓同名を正しく分離）
        const matches = (r: ReportData) =>
            customer.phoneKey
                ? normalizePhone(r.customerPhone) === customer.phoneKey
                : r.customerName === customer.name;
        const customerReports = reports.filter(matches);
        const callCount = customerReports.length;
        const monthlyReports = monthReports.filter(matches);
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
        if (customerSortBy === 'balance_desc') {
            return b.balance - a.balance;
        }
        if (customerSortBy === 'monthly_amount_desc') {
            return b.monthlyAmount - a.monthlyAmount;
        }
        if (customerSortBy === 'call_count_desc') {
            return b.callCount - a.callCount;
        }
        return 0;
    }).filter(customer => {
        if (showBlacklistOnly && (!customer.phone || customer.phone === '登録なし' || !blacklistedPhones.some(bl => normalizePhone(bl) === normalizePhone(customer.phone)))) return false;
        if (showDepositOnly && customer.balance === 0) return false;
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
                    <div className="pt-4 mt-2 border-t border-[#242036]">
                        <a href="/mypage" target="_blank" className="w-full text-left px-5 py-3 flex items-center gap-3 transition-colors text-gray-400 hover:bg-[#1a1a28] hover:text-gray-200 border-l-4 border-transparent text-sm">
                            <span className="text-lg">✏️</span>
                            <span>業務報告入力</span>
                        </a>
                        <a href="/customer/login" target="_blank" className="w-full text-left px-5 py-3 flex items-center gap-3 transition-colors text-gray-400 hover:bg-[#1a1a28] hover:text-gray-200 border-l-4 border-transparent text-sm">
                            <span className="text-lg">👤</span>
                            <span>顧客マイページ</span>
                        </a>
                    </div>
                </nav>
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
                                    <div
                                        onClick={() => { setActiveTab('reports'); setShowUnpaidOnly(true); }}
                                        className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-red-400 flex flex-col justify-center cursor-pointer hover:shadow-md hover:bg-red-50/30 transition-all"
                                        title="クリックで未入金一覧を表示"
                                    >
                                        <p className="text-xs text-gray-500 font-medium mb-1">未入金額</p>
                                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100">¥{totalUnpaid.toLocaleString()}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">{unpaidCount}件未入金 →</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-purple-400 flex flex-col justify-center">
                                        <p className="text-xs text-gray-500 font-medium mb-1">通話件数</p>
                                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{totalCalls}件</p>
                                        <p className="text-[10px] text-gray-400 mt-1">稼働スタッフ {activeStaffCount}名</p>
                                    </div>
                                </section>

                                {/* 売上推移チャート */}
                                <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b dark:border-gray-700 border-gray-100 pb-2 gap-2">
                                        <h2 className="font-bold text-gray-800 dark:text-gray-200">売上推移（直近{trendMonths}ヶ月）</h2>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* 6ヶ月/12ヶ月トグル */}
                                            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                                                <button
                                                    onClick={() => { setTrendMonths(6); setTrendOffset(0); }}
                                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${trendMonths === 6 ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                                >
                                                    6ヶ月
                                                </button>
                                                <button
                                                    onClick={() => { setTrendMonths(12); setTrendOffset(0); }}
                                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${trendMonths === 12 ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                                >
                                                    12ヶ月
                                                </button>
                                            </div>
                                            {/* 期間スライドボタン */}
                                            <button onClick={() => setTrendOffset(trendOffset - trendMonths)} className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
                                                &lt; 前期間
                                            </button>
                                            <button onClick={() => setTrendOffset(0)} disabled={trendOffset === 0} className={`px-3 py-1 text-sm ${trendOffset === 0 ? 'bg-gray-200 dark:bg-gray-700 opacity-50 cursor-not-allowed' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'} rounded transition-colors`}>
                                                今月
                                            </button>
                                            <button onClick={() => setTrendOffset(trendOffset + trendMonths)} disabled={trendOffset >= 0} className={`px-3 py-1 text-sm ${trendOffset >= 0 ? 'bg-gray-200 dark:bg-gray-700 opacity-50 cursor-not-allowed' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'} rounded transition-colors`}>
                                                次期間 &gt;
                                            </button>
                                        </div>
                                    </div>
                                    {/* 凡例 */}
                                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-sm bg-[#4cd9c0]"></div>
                                            <span>売上</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-sm bg-[#6366f1]"></div>
                                            <span>オーナー取り分</span>
                                        </div>
                                    </div>
                                    <div className={`flex items-end justify-between ${trendMonths === 12 ? 'gap-0.5' : 'gap-1 sm:gap-4'} h-48 mt-2`}>
                                        {trendData.map((data, idx) => (
                                            <div key={idx} className="flex flex-col items-center flex-1 gap-1">
                                                <div className={`w-full flex justify-center items-end h-36 relative group ${trendMonths === 12 ? 'gap-[1px]' : 'gap-1'}`}>
                                                    {/* ツールチップ */}
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none font-medium leading-relaxed">
                                                        売上: ¥{(data.sales / 10000).toFixed(1)}万<br />
                                                        取分: ¥{(data.profit / 10000).toFixed(1)}万
                                                    </div>
                                                    {/* 売上バー */}
                                                    <div
                                                        className={`${trendMonths === 12 ? 'max-w-[18px]' : 'max-w-[32px]'} w-1/2 bg-[#4cd9c0] hover:bg-[#3dbfa8] rounded-t-sm transition-all duration-500 ease-out cursor-pointer`}
                                                        style={{ height: `${Math.max((data.sales / maxTrendSales) * 100, 1)}%` }}
                                                    ></div>
                                                    {/* オーナー取り分バー */}
                                                    <div
                                                        className={`${trendMonths === 12 ? 'max-w-[18px]' : 'max-w-[32px]'} w-1/2 bg-[#6366f1] hover:bg-[#4f46e5] rounded-t-sm transition-all duration-500 ease-out cursor-pointer`}
                                                        style={{ height: `${Math.max((data.profit / maxTrendSales) * 100, 1)}%` }}
                                                    ></div>
                                                </div>
                                                <div className={`${trendMonths === 12 ? 'text-[10px]' : 'text-xs'} text-gray-500 dark:text-gray-400 font-bold whitespace-nowrap`}>{data.monthStr}</div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* 年間売上推移グラフ */}
                                {yearlyStats.length > 0 && (
                                    <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-4 mt-6">
                                        <div className="flex items-center justify-between border-b dark:border-gray-700 border-gray-100 pb-2">
                                            <h2 className="font-bold text-gray-800 dark:text-gray-200">年間売上推移（直近{yearlyStats.length}年）</h2>
                                            <div className="text-xs text-gray-400 dark:text-gray-500">
                                                累計: ¥{yearlyStats.reduce((s, ys) => s + ys.sales, 0).toLocaleString()}
                                            </div>
                                        </div>
                                        {/* 凡例 */}
                                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 rounded-sm bg-[#4cd9c0]"></div>
                                                <span>売上</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 rounded-sm bg-[#6366f1]"></div>
                                                <span>オーナー取り分</span>
                                            </div>
                                        </div>
                                        <div className="flex items-end justify-between gap-2 sm:gap-6 h-48 mt-2">
                                            {yearlyStats.map((ys, idx) => (
                                                <div key={idx} className="flex flex-col items-center flex-1 gap-1">
                                                    <div className="w-full flex justify-center items-end h-36 relative group gap-1">
                                                        {/* ツールチップ */}
                                                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none font-medium leading-relaxed">
                                                            売上: ¥{(ys.sales / 10000).toFixed(1)}万<br />
                                                            取分: ¥{(ys.profit / 10000).toFixed(1)}万<br />
                                                            利益率: {ys.sales > 0 ? Math.round(ys.profit / ys.sales * 100) : 0}%
                                                        </div>
                                                        {/* 売上バー */}
                                                        <div
                                                            className="max-w-[40px] w-1/2 bg-[#4cd9c0] hover:bg-[#3dbfa8] rounded-t-sm transition-all duration-500 ease-out cursor-pointer"
                                                            style={{ height: `${Math.max((ys.sales / maxYearlySales) * 100, 1)}%` }}
                                                        ></div>
                                                        {/* オーナー取り分バー */}
                                                        <div
                                                            className="max-w-[40px] w-1/2 bg-[#6366f1] hover:bg-[#4f46e5] rounded-t-sm transition-all duration-500 ease-out cursor-pointer"
                                                            style={{ height: `${Math.max((ys.profit / maxYearlySales) * 100, 1)}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 font-bold whitespace-nowrap">
                                                        {ys.year === currentYear ? <span className="text-indigo-500">{ys.year}年</span> : `${ys.year}年`}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

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
                                                            <td className="py-3 px-4">¥{(isOwnerStaff(s.name) ? s.sales : (s.sales - s.share)).toLocaleString()}</td>
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
                                <section className="flex flex-wrap gap-3 mb-6 items-center">
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
                                    <button
                                        onClick={() => setShowUnpaidOnly(!showUnpaidOnly)}
                                        className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all border ${showUnpaidOnly ? 'bg-red-500 text-white border-red-500 shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                    >
                                        {showUnpaidOnly ? '✕ フィルタ解除' : '未入金のみ表示'}
                                    </button>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                                        <input
                                            type="text"
                                            placeholder="名前・スタッフ・電話番号で検索..."
                                            className="border border-gray-200 dark:border-gray-700 pl-8 pr-4 py-2 text-sm rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 w-64 focus:w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                            value={reportSearchQuery}
                                            onChange={(e) => setReportSearchQuery(e.target.value)}
                                        />
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
                                                    <th className="px-6 py-4 font-medium whitespace-nowrap">入金</th>
                                                    <th className="px-6 py-4 font-medium whitespace-nowrap">日付</th>
                                                    <th className="px-6 py-4 font-medium whitespace-nowrap">スタッフ</th>
                                                    <th className="px-6 py-4 font-medium whitespace-nowrap">お客様名</th>
                                                    <th className="px-6 py-4 font-medium whitespace-nowrap">電話番号</th>
                                                    <th className="px-6 py-4 font-medium whitespace-nowrap">サービス</th>
                                                    <th className="px-6 py-4 font-medium whitespace-nowrap">売上</th>
                                                    <th className="px-6 py-4 font-medium whitespace-nowrap">デポジット</th>
                                                    <th className="px-6 py-4 font-medium whitespace-nowrap">請求額</th>
                                                    <th className="px-6 py-4 font-medium whitespace-nowrap">入金日</th>
                                                    <th className="px-6 py-4 font-medium whitespace-nowrap text-center">操作</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {(() => {
                                                    const baseReports = showUnpaidOnly ? reports.filter(r => !r.isPaid || recentlyPaidIds.has(r.id)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : monthReports;
                                                    const filteredReports = reportSearchQuery.trim() ? baseReports.filter(r => {
                                                        const q = reportSearchQuery.trim().toLowerCase();
                                                        return r.customerName.toLowerCase().includes(q) || r.staff.toLowerCase().includes(q) || r.customerPhone.includes(q) || normalizePhone(r.customerPhone).includes(normalizePhone(q));
                                                    }) : baseReports;
                                                    return filteredReports.length === 0 && !isLoading && !errorText ? (
                                                        <tr>
                                                            <td colSpan={11} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
                                                                {reportSearchQuery.trim() ? '検索条件に一致するデータがありません' : showUnpaidOnly ? '未入金の報告データがありません' : '当月の報告データがありません'}
                                                            </td>
                                                        </tr>
                                                    ) : null;
                                                })()}
                                                {(() => {
                                                    const baseReports = showUnpaidOnly ? reports.filter(r => !r.isPaid || recentlyPaidIds.has(r.id)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : monthReports;
                                                    return reportSearchQuery.trim() ? baseReports.filter(r => {
                                                        const q = reportSearchQuery.trim().toLowerCase();
                                                        return r.customerName.toLowerCase().includes(q) || r.staff.toLowerCase().includes(q) || r.customerPhone.includes(q) || normalizePhone(r.customerPhone).includes(normalizePhone(q));
                                                    }) : baseReports;
                                                })().map((report) => {
                                                    const isEditing = editingReportId === report.id;
                                                    const isUrgent = !report.isPaid && report.daysPending >= 3;
                                                    return (
                                                        <tr key={report.id} className={`hover:bg-gray-50/50 dark:bg-gray-800/50 transition-colors border-b dark:border-gray-700 ${isUrgent ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                                            <td className="px-6 py-4">
                                                                <button
                                                                    onClick={() => togglePaidStatus(report.id, report.isPaid)}
                                                                    className={`w-5 h-5 flex items-center justify-center rounded transition-colors border shadow-sm ${report.isPaid ? 'bg-[#4cd9c0] border-transparent text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}`}
                                                                >
                                                                    {report.isPaid && <span className="text-sm">✓</span>}
                                                                </button>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                                {new Date(report.date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                                                            </td>
                                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{report.staff}</td>
                                                            <td className="px-6 py-4 text-gray-900 dark:text-gray-100 min-w-[8em]">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editReportData.customerName}
                                                                        onChange={(e) => setEditReportData({ ...editReportData, customerName: e.target.value })}
                                                                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                                                                    />
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5 flex-nowrap">
                                                                        <span className="whitespace-nowrap">{report.customerName}</span>
                                                                        {isUrgent && (
                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500 text-white font-bold whitespace-nowrap shrink-0">催促要</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="tel"
                                                                        value={editReportData.customerPhone}
                                                                        onChange={(e) => setEditReportData({ ...editReportData, customerPhone: e.target.value })}
                                                                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                                                                        placeholder="090-1234-5678"
                                                                    />
                                                                ) : (
                                                                    formatPhone(report.customerPhone)
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {report.services.split(', ').map(s => {
                                                                    const parsedService = parseServiceName(s);
                                                                    let bgClass = "bg-blue-50 text-blue-600";
                                                                    if (s.includes('占い')) bgClass = "bg-pink-50 text-pink-600";
                                                                    if (s.includes('性的')) bgClass = "bg-yellow-50 text-yellow-700";
                                                                    return <span key={s} className={`text-[11px] px-2 py-0.5 rounded mr-1 ${bgClass}`}>{parsedService}</span>;
                                                                })}
                                                            </td>
                                                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        value={editReportData.totalSales}
                                                                        onChange={(e) => setEditReportData({ ...editReportData, totalSales: Number(e.target.value) })}
                                                                        className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                                                                    />
                                                                ) : (
                                                                    `¥${report.totalSales.toLocaleString()}`
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {report.depositUsed > 0 ? (
                                                                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">-¥{report.depositUsed.toLocaleString()}</span>
                                                                ) : (
                                                                    <span className="text-[11px] text-gray-400 dark:text-gray-500">-</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {report.billingAmount === 0 ? (
                                                                    <span className="text-[11px] text-green-600 dark:text-green-400 font-bold">全額充当</span>
                                                                ) : report.depositUsed > 0 ? (
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-orange-600 dark:text-orange-400">¥{report.billingAmount.toLocaleString()}</span>
                                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400">（一部充当）</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="font-bold text-gray-900 dark:text-gray-100">¥{report.billingAmount.toLocaleString()}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`text-[12px] font-bold ${report.isPaid ? 'text-[#4cd9c0]' : 'text-red-400'}`}>
                                                                    {report.isPaid ? formatPaymentDate(report.paymentDate || report.date) : '未入金'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    {!isEditing && (
                                                                        <>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditingReportId(report.id);
                                                                                    setEditReportData({
                                                                                        customerName: report.customerName,
                                                                                        customerPhone: report.customerPhone,
                                                                                        totalSales: report.totalSales
                                                                                    });
                                                                                }}
                                                                                className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap"
                                                                            >
                                                                                編集
                                                                            </button>
                                                                            <button
                                                                                onClick={async () => {
                                                                                    if (!confirm('この報告を削除しますか？この操作は取り消せません。')) return;
                                                                                    setIsSaving(true);
                                                                                    try {
                                                                                        const res = await fetch(GAS_URL, {
                                                                                            method: 'POST',
                                                                                            body: JSON.stringify({ action: 'deleteReport', id: report.id })
                                                                                        });
                                                                                        const json = await res.json();
                                                                                        if (json.success) {
                                                                                            setReports(prev => prev.filter(r => r.id !== report.id));
                                                                                            if (json.customerName && json.newBalance !== undefined) {
                                                                                                setDeposits(prev => ({ ...prev, [json.customerName]: json.newBalance }));
                                                                                            }
                                                                                            showToast('報告を削除しました');
                                                                                        } else {
                                                                                            alert('エラー: ' + (json.message || '削除に失敗しました'));
                                                                                        }
                                                                                    } catch (e) {
                                                                                        console.error(e);
                                                                                        alert('エラーが発生しました');
                                                                                    } finally {
                                                                                        setIsSaving(false);
                                                                                    }
                                                                                }}
                                                                                className="px-2 py-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors whitespace-nowrap"
                                                                            >
                                                                                削除
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    {isEditing && (
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={async () => {
                                                                                    setIsSaving(true);
                                                                                    try {
                                                                                        const res = await fetch(GAS_URL, {
                                                                                            method: 'POST',
                                                                                            body: JSON.stringify({
                                                                                                action: 'editReport',
                                                                                                id: report.id,
                                                                                                customerName: editReportData.customerName,
                                                                                                customerPhone: normalizePhone(editReportData.customerPhone),
                                                                                                totalSales: editReportData.totalSales
                                                                                            })
                                                                                        });
                                                                                        const json = await res.json();
                                                                                        if (json.success) {
                                                                                            setEditingReportId(null);
                                                                                            // ローカルのreportsステートを直接更新
                                                                                            setReports(prev => prev.map(r => r.id === report.id ? { ...r, customerName: editReportData.customerName, customerPhone: editReportData.customerPhone, totalSales: editReportData.totalSales } : r));
                                                                                            if (json.customerName && json.newBalance !== undefined) {
                                                                                                setDeposits(prev => ({ ...prev, [json.customerName]: json.newBalance }));
                                                                                            }
                                                                                            showToast('報告を更新しました');
                                                                                        } else {
                                                                                            alert('エラー: ' + (json.message || '更新に失敗しました'));
                                                                                        }
                                                                                    } catch (e) {
                                                                                        console.error(e);
                                                                                        alert('エラーが発生しました');
                                                                                    } finally {
                                                                                        setIsSaving(false);
                                                                                    }
                                                                                }}
                                                                                className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded text-xs font-bold hover:bg-green-100 dark:hover:bg-green-900/50"
                                                                            >
                                                                                保存
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setEditingReportId(null)}
                                                                                className="px-2 py-1 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-600"
                                                                            >
                                                                                キャンセル
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
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
                                <div className="px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b dark:border-gray-800 bg-white dark:bg-[#111111]">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">スタッフ管理</h2>
                                        <button
                                            onClick={() => setShowAddStaffModal(true)}
                                            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold px-4 py-1.5 rounded-lg text-sm hover:bg-gray-800 dark:hover:bg-white transition-colors shadow-sm whitespace-nowrap"
                                        >
                                            ＋ スタッフを追加する
                                        </button>
                                        <input
                                            type="month"
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(e.target.value)}
                                            className="border-none bg-gray-100 dark:bg-gray-800 rounded-lg pl-3 pr-2 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-all cursor-pointer"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
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
                                <div className="overflow-x-auto relative p-4">
                                    <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                <th className="px-4 py-3 font-medium">スタッフ</th>
                                                <th className="px-4 py-3 font-medium text-right">今月の通話件数</th>
                                                <th className="px-4 py-3 font-medium text-right">今月の売上額</th>
                                                <th className="px-4 py-3 font-medium text-right">今月の取り分</th>
                                                <th className="px-4 py-3 font-medium text-right">累計の報酬額</th>
                                                <th className="px-4 py-3 font-medium">対応サービス</th>
                                                <th className="px-4 py-3 font-medium text-center">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {staffStats.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">データがありません</td>
                                                </tr>
                                            )}
                                            {staffStats.map((s) => {
                                                // 今月の通話件数を計算
                                                const monthStaffReports = monthReports.filter(r => r.staff === s.name);
                                                const callCount = monthStaffReports.length;

                                                // サービス別内訳を計算
                                                const serviceBreakdown = new Map<string, number>();
                                                monthStaffReports.forEach(r => {
                                                    r.services.split(', ').forEach(service => {
                                                        const serviceName = parseServiceName(service).split(' ')[0]; // "占い 40分" → "占い"
                                                        serviceBreakdown.set(serviceName, (serviceBreakdown.get(serviceName) || 0) + r.staffShare);
                                                    });
                                                });

                                                return (
                                                    <tr key={s.name} className="hover:bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="font-bold text-gray-900 dark:text-gray-100">{s.name}</div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{staffEmails[s.name] || '未登録'}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="text-gray-700 dark:text-gray-300 font-medium">{callCount}件</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="text-gray-900 dark:text-gray-100 font-bold">¥{s.sales.toLocaleString()}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="text-gray-900 dark:text-gray-100 font-bold">¥{s.share.toLocaleString()}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="text-gray-700 dark:text-gray-300 font-medium">¥{s.totalShare.toLocaleString()}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-wrap gap-1">
                                                                {(() => {
                                                                    const svcs = (staffServices[s.name] || '').split(',').map(ss => ss.trim()).filter(Boolean);
                                                                    if (svcs.length === 0) return <span className="text-xs text-gray-400">-</span>;
                                                                    return svcs.map(serviceName => {
                                                                        let bgClass = "bg-blue-50 text-blue-700 border-blue-200";
                                                                        if (serviceName.includes('占い')) bgClass = "bg-pink-50 text-pink-700 border-pink-200";
                                                                        if (serviceName.includes('傾聴')) bgClass = "bg-green-50 text-green-700 border-green-200";
                                                                        if (serviceName.includes('性的')) bgClass = "bg-yellow-50 text-yellow-700 border-yellow-200";
                                                                        return (
                                                                            <span key={serviceName} className={`text-[10px] px-2 py-0.5 rounded border ${bgClass} font-medium whitespace-nowrap`}>
                                                                                {serviceName}
                                                                            </span>
                                                                        );
                                                                    });
                                                                })()}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                                                                <button
                                                                    onClick={() => setShowStaffDetailFor(s.name)}
                                                                    className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors whitespace-nowrap"
                                                                    title="詳細を見る">
                                                                    👁️ 詳細
                                                                </button>
                                                                <button
                                                                    onClick={() => setSelectedPdfStaff(s.name)}
                                                                    className="px-2.5 py-1 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
                                                                    title="PDF作成">
                                                                    📄 PDF
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingStaffName(s.name);
                                                                        setEditStaffData({
                                                                            name: s.name,
                                                                            password: staffPasswords[s.name] || '',
                                                                            email: staffEmails[s.name] || '',
                                                                            services: (staffServices[s.name] || '').split(',').map(ss => ss.trim()).filter(Boolean)
                                                                        });
                                                                    }}
                                                                    className="px-2.5 py-1 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors whitespace-nowrap"
                                                                    title="設定変更">
                                                                    ⚙️
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* スタッフ編集モーダル */}
                                {editingStaffName && (
                                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingStaffName(null)}>
                                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">スタッフ情報の編集</h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">スタッフ名</label>
                                                    <input
                                                        type="text"
                                                        value={editStaffData.name}
                                                        onChange={(e) => setEditStaffData({ ...editStaffData, name: e.target.value })}
                                                        className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">パスワード</label>
                                                    <input
                                                        type="text"
                                                        value={editStaffData.password}
                                                        onChange={(e) => setEditStaffData({ ...editStaffData, password: e.target.value })}
                                                        className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                                        placeholder="変更しない場合は空欄"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">メールアドレス</label>
                                                    <input
                                                        type="email"
                                                        value={editStaffData.email}
                                                        onChange={(e) => setEditStaffData({ ...editStaffData, email: e.target.value })}
                                                        className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">対応サービス</label>
                                                    <div className="flex gap-4 items-center flex-wrap mt-2">
                                                        {['傾聴', '占い', '性的な相談'].map(srv => (
                                                            <label key={srv} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700 dark:text-gray-200">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={editStaffData.services.includes(srv)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setEditStaffData(prev => ({ ...prev, services: [...prev.services, srv] }));
                                                                        } else {
                                                                            setEditStaffData(prev => ({ ...prev, services: prev.services.filter(s => s !== srv) }));
                                                                        }
                                                                    }}
                                                                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                                />
                                                                {srv}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 mt-6">
                                                <button
                                                    onClick={() => setEditingStaffName(null)}
                                                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    キャンセル
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        setIsSaving(true);
                                                        try {
                                                            setEditingStaffName(null);
                                                            await fetch(GAS_URL, {
                                                                method: 'POST',
                                                                body: JSON.stringify({
                                                                    action: 'editStaff',
                                                                    oldName: editingStaffName,
                                                                    newName: editStaffData.name,
                                                                    password: editStaffData.password,
                                                                    email: editStaffData.email,
                                                                    services: editStaffData.services.join(', ')
                                                                })
                                                            });
                                                            fetchStaffList();
                                                            setToastMessage('スタッフ情報を更新しました');
                                                            setTimeout(() => setToastMessage(null), 3000);
                                                        } catch (e) {
                                                            setToastMessage('エラーが発生しました');
                                                            setTimeout(() => setToastMessage(null), 3000);
                                                        } finally {
                                                            setIsSaving(false);
                                                        }
                                                    }}
                                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                                                >
                                                    保存
                                                </button>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm(`${editingStaffName}さんを削除しますか？\nこの操作は取り消せません。`)) return;
                                                        setIsSaving(true);
                                                        try {
                                                            const res = await fetch(GAS_URL, {
                                                                method: 'POST',
                                                                body: JSON.stringify({ action: 'deleteStaff', name: editingStaffName })
                                                            });
                                                            const json = await res.json();
                                                            if (json.success) {
                                                                setEditingStaffName(null);
                                                                fetchStaffList();
                                                                showToast('スタッフを削除しました');
                                                            } else {
                                                                alert('エラー: ' + (json.message || '削除に失敗しました'));
                                                            }
                                                        } catch (e) {
                                                            console.error(e);
                                                            alert('エラーが発生しました');
                                                        } finally {
                                                            setIsSaving(false);
                                                        }
                                                    }}
                                                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                                                >
                                                    このスタッフを削除
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* スタッフ追加モーダル */}
                                {showAddStaffModal && (
                                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddStaffModal(false)}>
                                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">新しいスタッフを追加</h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">スタッフ名</label>
                                                    <input
                                                        type="text"
                                                        value={newStaffData.name}
                                                        onChange={(e) => setNewStaffData({ ...newStaffData, name: e.target.value })}
                                                        className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">パスワード</label>
                                                    <input
                                                        type="text"
                                                        value={newStaffData.password}
                                                        onChange={(e) => setNewStaffData({ ...newStaffData, password: e.target.value })}
                                                        className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">メールアドレス</label>
                                                    <input
                                                        type="email"
                                                        value={newStaffData.email}
                                                        onChange={(e) => setNewStaffData({ ...newStaffData, email: e.target.value })}
                                                        className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">対応サービス</label>
                                                    <div className="flex gap-4 items-center flex-wrap mt-2">
                                                        {['傾聴', '占い', '性的な相談'].map(srv => (
                                                            <label key={srv} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700 dark:text-gray-200">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={newStaffData.services.includes(srv)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setNewStaffData(prev => ({ ...prev, services: [...prev.services, srv] }));
                                                                        } else {
                                                                            setNewStaffData(prev => ({ ...prev, services: prev.services.filter(s => s !== srv) }));
                                                                        }
                                                                    }}
                                                                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                                />
                                                                {srv}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 mt-6">
                                                <button
                                                    onClick={() => {
                                                        setShowAddStaffModal(false);
                                                        setNewStaffData({ name: '', password: '', email: '', services: [] });
                                                    }}
                                                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    キャンセル
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        setIsSaving(true);
                                                        try {
                                                            setShowAddStaffModal(false);
                                                            await fetch(GAS_URL, {
                                                                method: 'POST',
                                                                body: JSON.stringify({
                                                                    action: 'addStaff',
                                                                    name: newStaffData.name,
                                                                    password: newStaffData.password,
                                                                    email: newStaffData.email,
                                                                    services: newStaffData.services.join(', ')
                                                                })
                                                            });
                                                            setNewStaffData({ name: '', password: '', email: '', services: [] });
                                                            fetchStaffList();
                                                            setToastMessage('スタッフを追加しました');
                                                            setTimeout(() => setToastMessage(null), 3000);
                                                        } catch (e) {
                                                            setToastMessage('エラーが発生しました');
                                                            setTimeout(() => setToastMessage(null), 3000);
                                                        } finally {
                                                            setIsSaving(false);
                                                        }
                                                    }}
                                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                                                >
                                                    追加
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
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

                                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={showDepositOnly}
                                                    onChange={(e) => setShowDepositOnly(e.target.checked)}
                                                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 w-4 h-4"
                                                />
                                                <span className="font-medium text-sm">💰 デポジット管理</span>
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
                                                <option value="balance_desc">デポジット残高順</option>
                                                <option value="paid_desc">累計利用額順</option>
                                                <option value="monthly_amount_desc">今月の利用額順</option>
                                                <option value="call_count_desc">通話回数順</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto relative p-4">
                                    <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => setCustomerSortBy('name_asc')}>名前 {customerSortBy === 'name_asc' ? '▲' : ''}</th>
                                                <th className="px-4 py-3 font-medium">電話番号</th>
                                                <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => setCustomerSortBy('registered_desc')}>登録日 {customerSortBy === 'registered_desc' ? '▼' : ''}</th>
                                                <th className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => setCustomerSortBy('call_count_desc')}>通話回数 {customerSortBy === 'call_count_desc' ? '▼' : ''}</th>
                                                <th className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => setCustomerSortBy('monthly_amount_desc')}>今月の通話利用額 {customerSortBy === 'monthly_amount_desc' ? '▼' : ''}</th>
                                                <th className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => setCustomerSortBy('paid_desc')}>累計利用額 {customerSortBy === 'paid_desc' ? '▼' : ''}</th>
                                                <th className="px-4 py-3 font-medium text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => setCustomerSortBy('balance_desc')}>デポジット残高 {customerSortBy === 'balance_desc' ? '▼' : ''}</th>
                                                <th className="px-4 py-3 font-medium text-center">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {customerList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                                                        データがありません。上の「＋ 追加する」ボタンから顧客を追加してください。
                                                    </td>
                                                </tr>
                                            ) : (
                                                customerList.map(({ name: customerName, phone, registeredDate, customerNumber, callCount, monthlyAmount, totalPaid, balance }) => (
                                                    <tr key={`${customerName}-${phone}`} className="hover:bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-gray-900 dark:text-gray-100">{customerName}</span>
                                                                {phone && phone !== '登録なし' && blacklistedPhones.some(bl => normalizePhone(bl) === normalizePhone(phone)) && (
                                                                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-200 whitespace-nowrap">NG</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-gray-600 dark:text-gray-400 text-sm">{phone && phone !== '登録なし' ? formatPhone(phone) : phone}</span>
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
                                                        <td className="px-4 py-3 text-right">
                                                            <span className={`font-bold ${balance > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                                                ¥{balance.toLocaleString()}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                                                                <button
                                                                    onClick={() => {
                                                                        setChargeTarget(customerName);
                                                                        setChargeTargetPhone(phone);
                                                                        setShowChargeModal(true);
                                                                    }}
                                                                    className="px-2.5 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700 rounded text-xs font-bold hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap">
                                                                    💰 チャージ
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        setIsSaving(true);
                                                                        try {
                                                                            // 両方のデータが揃うまで待機
                                                                            await fetchDepositLogs();
                                                                            // reportsは既に取得済みなので、両方揃った状態でモーダルを開く
                                                                            setShowHistoryForCustomer(customerName);
                                                                        } finally {
                                                                            setIsSaving(false);
                                                                        }
                                                                    }}
                                                                    className="px-2.5 py-1 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap">
                                                                    📄 ご利用履歴
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingCustomerName(customerName);
                                                                        setEditCustomerData({ customerName: customerName, customerPhone: phone === '登録なし' ? '' : phone, customerPassword: customerPasswords[customerName] || '' });
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
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">マイページパスワード</label>
                                                    <input
                                                        type="text"
                                                        value={editCustomerData.customerPassword}
                                                        onChange={(e) => setEditCustomerData({ ...editCustomerData, customerPassword: e.target.value })}
                                                        className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                                        placeholder="顧客マイページ用のパスワード"
                                                    />
                                                </div>
                                            </div>
                                            {/* デポジット残高の調整セクション */}
                                            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">デポジット残高の調整</h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">現在の残高: ¥{(deposits[editingCustomerName] || 0).toLocaleString()}</p>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        id="fixBalanceInput"
                                                        placeholder="新しい残高を入力"
                                                        className="flex-1 border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-gray-100"
                                                    />
                                                    <button
                                                        disabled={isSaving}
                                                        onClick={async () => {
                                                            const input = document.getElementById('fixBalanceInput') as HTMLInputElement;
                                                            const newBalance = Number(input?.value);
                                                            if (isNaN(newBalance) || input?.value === '') {
                                                                return alert('有効な金額を入力してください');
                                                            }
                                                            if (!confirm(`${editingCustomerName} さんの残高を ¥${newBalance.toLocaleString()} に上書きしますか？`)) return;
                                                            setIsSaving(true);
                                                            setSavingMessage('残高を調整中...');
                                                            try {
                                                                const res = await fetch(GAS_URL, {
                                                                    method: 'POST',
                                                                    body: JSON.stringify({
                                                                        action: 'fixDepositBalance',
                                                                        customerName: editingCustomerName,
                                                                        customerPhone: customerList.find(c => c.name === editingCustomerName)?.phone || '',
                                                                        newBalance: newBalance
                                                                    })
                                                                });
                                                                const resJson = await res.json();
                                                                if (resJson.success) {
                                                                    setDeposits(prev => ({ ...prev, [editingCustomerName!]: resJson.newBalance }));
                                                                    alert('残高を更新しました');
                                                                    input.value = '';
                                                                } else {
                                                                    alert('エラー: ' + (resJson.message || '残高の更新に失敗しました'));
                                                                }
                                                            } catch (e) {
                                                                alert('エラーが発生しました');
                                                            } finally {
                                                                setIsSaving(false);
                                                                setSavingMessage(null);
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        残高を上書き
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-3 mt-4">
                                                {/* ブラックリスト登録ボタン */}
                                                {editCustomerData.customerPhone && editCustomerData.customerPhone !== '登録なし' && !blacklistedPhones.some(bl => normalizePhone(bl) === normalizePhone(editCustomerData.customerPhone)) && (
                                                    <button
                                                        onClick={async () => {
                                                            await handleAddBlacklist(editCustomerData.customerPhone, editCustomerData.customerName);
                                                            setEditingCustomerName(null);
                                                        }}
                                                        className="w-full px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700 rounded-lg font-bold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                                    >
                                                        🚫 ブラックリストに登録
                                                    </button>
                                                )}

                                                {/* 顧客削除ボタン */}
                                                <button
                                                    disabled={isSaving}
                                                    onClick={async () => {
                                                        const name = editCustomerData.customerName || editingCustomerName;
                                                        if (!confirm(`「${name}」さんを削除しますか？\n\n以下が削除されます:\n・顧客リストの登録\n・前払い管理の残高\n・デポジット履歴\n\n※業務報告（売上記録）は残ります。`)) return;
                                                        if (!confirm(`本当に削除してよろしいですか？\nこの操作は取り消せません。`)) return;
                                                        setIsSaving(true);
                                                        setSavingMessage('顧客情報を削除中...');
                                                        try {
                                                            const res = await fetch(GAS_URL, {
                                                                method: 'POST',
                                                                body: JSON.stringify({ action: 'deleteCustomer', customerName: editingCustomerName })
                                                            });
                                                            const json = await res.json();
                                                            if (json.success) {
                                                                const deletedName = editingCustomerName;
                                                                setEditingCustomerName(null);
                                                                // ローカルステートからも削除
                                                                setDeposits(prev => { const n = { ...prev }; delete n[deletedName!]; return n; });
                                                                setCustomerPhones(prev => { const n = { ...prev }; delete n[deletedName!]; return n; });
                                                                setCustomerPasswords(prev => { const n = { ...prev }; delete n[deletedName!]; return n; });
                                                                // 全データ再取得（業務報告の顧客名参照も消すため）
                                                                fetchReports(false);
                                                                fetchDeposits();
                                                                const histRes = await fetch(`${GAS_URL}?action=getDepositHistory`);
                                                                const histJson = await histRes.json();
                                                                if (histJson.success) setDepositLogs(histJson.history);
                                                                showToast(`${deletedName} さんを削除しました`);
                                                            } else {
                                                                alert('エラー: ' + (json.message || '削除に失敗しました'));
                                                            }
                                                        } catch (e) {
                                                            alert('エラーが発生しました');
                                                        } finally {
                                                            setIsSaving(false);
                                                            setSavingMessage(null);
                                                        }
                                                    }}
                                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900/30 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors text-sm disabled:opacity-50"
                                                >
                                                    この顧客を削除する
                                                </button>

                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => setEditingCustomerName(null)}
                                                        className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                    >
                                                        キャンセル
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            setIsSaving(true);
                                                            try {
                                                                setEditingCustomerName(null);
                                                                const normalizedPhone = normalizePhone(editCustomerData.customerPhone);
                                                                await fetch(GAS_URL, {
                                                                    method: 'POST',
                                                                    body: JSON.stringify({
                                                                        action: 'editCustomer',
                                                                        oldName: editingCustomerName,
                                                                        newName: editCustomerData.customerName,
                                                                        phone: normalizedPhone,
                                                                        password: editCustomerData.customerPassword
                                                                    })
                                                                });
                                                                fetchDeposits();
                                                                fetchReports();
                                                                alert('お客様情報を更新しました。');
                                                            } catch (e) {
                                                                alert('エラーが発生しました。');
                                                            } finally {
                                                                setIsSaving(false);
                                                            }
                                                        }}
                                                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                                                    >
                                                        保存する
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                                                    <td className="border border-gray-400 py-2 px-2 text-gray-700 print:text-black">{formatJSTDate(r.date).slice(5)}</td>
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
                                    <button
                                        onClick={async () => {
                                            const toEmail = staffEmails[selectedPdfStaff];
                                            if (!toEmail) {
                                                alert(`${selectedPdfStaff}さんのメールアドレスが登録されていません。`);
                                                return;
                                            }
                                            if (!window.confirm(`${selectedPdfStaff}さん (${toEmail}) へ給与明細メールを送信しますか？`)) return;

                                            setIsSaving(true);
                                            try {
                                                const staffShare = staffStats.find(s => s.name === selectedPdfStaff)?.share || 0;
                                                const res = await fetch(GAS_URL, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'text/plain' },
                                                    body: JSON.stringify({
                                                        action: 'sendEmail',
                                                        to: toEmail,
                                                        subject: `【ハナシタラ.com】${currentMonthStr.replace('-', '年')}月分 給与明細のお知らせ`,
                                                        body: `${selectedPdfStaff} 様\n\nお疲れ様です。ハナシタラ.comです。\n${currentMonthStr.replace('-', '年')}月分の給与計算が完了いたしました。\n\n【合計振込額】: ¥${staffShare.toLocaleString()}\n\n詳細はスタッフマイページにログインの上、PDFにてご確認ください。\n引き続きよろしくお願いいたします。`
                                                    })
                                                });
                                                const json = await res.json();
                                                if (json.success) {
                                                    alert('メールを送信しました');
                                                    setSelectedPdfStaff(null);
                                                } else {
                                                    alert(`送信に失敗しました。\n理由: ${json.message || '不明なエラー'}`);
                                                }
                                            } catch (e) {
                                                console.error('通信エラー:', e);
                                                alert('通信エラーが発生しました。');
                                            } finally {
                                                setIsSaving(false);
                                            }
                                        }}
                                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 transition flex items-center gap-2"
                                    >
                                        ✉️ メールに添付して送信
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
                                                    <td className="px-4 py-3">{formatJSTDate(r.date).slice(5)}</td>
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
                                <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-xl">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{showHistoryForCustomer} 様の ご利用履歴</h3>
                                        <button onClick={() => setShowHistoryForCustomer(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:text-gray-200 text-xl font-bold">✕</button>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => setHistoryTabMode('detail')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${historyTabMode === 'detail' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                                            個別履歴
                                        </button>
                                        <button onClick={() => setHistoryTabMode('ledger')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${historyTabMode === 'ledger' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                                            📒 通帳
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 bg-gray-50/30">

                                    {/* 📒 通帳タブ（台帳形式・デポジット履歴を唯一の台帳として使う） */}
                                    {historyTabMode === 'ledger' && (() => {
                                        const customer = showHistoryForCustomer!;
                                        const customerPhoneForHistory = reports.find(r => r.customerName === customer)?.customerPhone || customerList.find(c => c.name === customer)?.phone || '';
                                        const normalizedPhoneForHistory = normalizePhone(customerPhoneForHistory);
                                        // デポジット履歴のみを参照（業務報告との重複を排除）
                                        const filteredLogs = depositLogs.filter(log => {
                                            if (normalizedPhoneForHistory && log.customerPhone) {
                                                return normalizePhone(log.customerPhone) === normalizedPhoneForHistory;
                                            }
                                            return log.customerName === customer;
                                        });
                                        // GASは最新→古い順に返すので挿入順（古い→新しい）に戻す
                                        const chronological = [...filteredLogs].reverse();
                                        // バックフィル行は残高が不正確なため、カラム F(GAS balance) が 0 の過去分行は前の残高を引き継ぐ
                                        let runningBalance = 0;
                                        const entriesWithBalance = chronological.map((log: any, i: number) => {
                                            const type = String(log.type || '');
                                            const amount = Number(log.amount) || 0;
                                            const isUsage = type.indexOf('利用') === 0;
                                            const isBackfill = type.indexOf('過去分') >= 0;
                                            const needsReview = type.indexOf('要確認') >= 0;
                                            // 関連する業務報告を reportId で引き当て（帳簿残高計算に使用）
                                            const relatedReportForCalc = log.reportId ? reports.find(r => r.id === log.reportId) : null;
                                            // 帳簿残高の計算（銀行口座風: 正=デポジット残高、負=未払い残高）
                                            //  - チャージ系(チャージ/残高調整/報告削除による返還/報告編集の返還等): GAS amount をそのまま加算
                                            //  - 利用(自動引落): GAS amount(=-売上) をそのまま加算
                                            //  - 利用(一部引落): 売上額満額を引く（デポ枯渇で負になる）
                                            //  - 利用(未払い): 売上額満額を引く
                                            //  - 直接入金確認: 請求額を加算（未払い帳消し）
                                            //  - 未払い充当: GAS amount(負) を加算
                                            //  - 利用(過去分): amount をそのまま加算（過去データは不正確な場合あり）
                                            if (type.indexOf('利用(一部引落)') === 0 && relatedReportForCalc) {
                                                runningBalance -= relatedReportForCalc.totalSales;
                                            } else if (type.indexOf('利用(未払い)') === 0 && relatedReportForCalc) {
                                                runningBalance -= relatedReportForCalc.totalSales;
                                            } else if (type.indexOf('直接入金確認') === 0 && relatedReportForCalc) {
                                                const billed = Number(relatedReportForCalc.billingAmount) || (relatedReportForCalc.totalSales - (relatedReportForCalc.depositUsed || 0));
                                                runningBalance += billed;
                                            } else {
                                                runningBalance += amount;
                                            }
                                            // 支払手段バッジ
                                            let paymentMethod = '';
                                            let paymentColor = '';
                                            if (type.indexOf('自動引落') >= 0 || (type.indexOf('デポジット引落') >= 0 && type.indexOf('一部') < 0)) {
                                                paymentMethod = 'デポジット';
                                                paymentColor = 'bg-purple-50 text-purple-700 border-purple-200';
                                            } else if (type.indexOf('一部引落') >= 0 || type.indexOf('一部デポジット') >= 0) {
                                                paymentMethod = '一部デポジット';
                                                paymentColor = 'bg-amber-50 text-amber-700 border-amber-200';
                                            } else if (type.indexOf('直接入金') >= 0) {
                                                paymentMethod = '直接入金';
                                                paymentColor = 'bg-sky-50 text-sky-700 border-sky-200';
                                            } else if (type.indexOf('未払い') >= 0) {
                                                paymentMethod = '未払い';
                                                paymentColor = 'bg-red-50 text-red-700 border-red-200';
                                            }
                                            // 関連する業務報告を reportId で引き当てる（利用行のラベル・編集・削除に使用）
                                            const reportId = String(log.reportId || '');
                                            const relatedReport = reportId ? reports.find(r => r.id === reportId) : null;
                                            let label: string;
                                            let totalSales = 0;
                                            let depositUsed = 0;
                                            let isPaid = true;
                                            if (isUsage) {
                                                if (relatedReport) {
                                                    label = `${relatedReport.staff} / ${relatedReport.services.replace(/\s*->\s*計算\d+分/g, '').replace(/\((\d+)分\)/g, ' $1分')}`;
                                                    totalSales = relatedReport.totalSales;
                                                    depositUsed = relatedReport.depositUsed || 0;
                                                    isPaid = relatedReport.isPaid;
                                                } else {
                                                    label = type;
                                                    totalSales = Math.abs(amount);
                                                    isPaid = type.indexOf('自動引落') >= 0 || type.indexOf('一部引落') >= 0 || type.indexOf('直接入金') >= 0;
                                                }
                                            } else {
                                                label = type;
                                            }
                                            // 表示用の入金/利用金額: 帳簿残高の変化と一致させる
                                            let creditAmount = 0;
                                            let debitAmount = 0;
                                            if (type.indexOf('直接入金確認') === 0 && relatedReportForCalc) {
                                                const billed = Number(relatedReportForCalc.billingAmount) || (relatedReportForCalc.totalSales - (relatedReportForCalc.depositUsed || 0));
                                                creditAmount = billed;
                                            } else if (type.indexOf('利用(一部引落)') === 0 && relatedReportForCalc) {
                                                debitAmount = relatedReportForCalc.totalSales;
                                            } else if (type.indexOf('利用(未払い)') === 0 && relatedReportForCalc) {
                                                debitAmount = relatedReportForCalc.totalSales;
                                            } else if (amount > 0) {
                                                creditAmount = amount;
                                            } else if (amount < 0) {
                                                debitAmount = Math.abs(amount);
                                            }
                                            return {
                                                date: log.date,
                                                type: isUsage ? ('usage' as const) : ('deposit' as const),
                                                rawType: type,
                                                label,
                                                amount,
                                                creditAmount,
                                                debitAmount,
                                                isPaid,
                                                id: reportId ? `rep-${reportId}-${i}` : `dep-${i}`,
                                                reportId,
                                                totalSales,
                                                depositUsed,
                                                customerPhone: log.customerPhone || '',
                                                gasBalance: Number(log.balance) || 0,
                                                balance: runningBalance,
                                                paymentMethod,
                                                paymentMethodColor: paymentColor,
                                                isBackfill,
                                                needsReview,
                                            };
                                        });

                                        // 編集・削除ハンドラー
                                        const handleEditUsage = (entry: typeof entriesWithBalance[0]) => {
                                            const newAmount = prompt(`売上額を変更（現在: ¥${entry.totalSales.toLocaleString()}）`, String(entry.totalSales));
                                            if (newAmount === null) return;
                                            const val = Number(newAmount);
                                            if (isNaN(val) || val < 0) { alert('有効な金額を入力してください'); return; }
                                            (async () => {
                                                setIsSaving(true); setSavingMessage('編集中...');
                                                try {
                                                    const rep = reports.find(r => r.id === entry.reportId);
                                                    const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'editReport', id: entry.reportId, customerName: customer, customerPhone: rep?.customerPhone || entry.customerPhone, totalSales: val }) });
                                                    const json = await res.json();
                                                    if (json.success) {
                                                        setReports(prev => prev.map(r => r.id === entry.reportId ? { ...r, totalSales: val } : r));
                                                        if (json.customerName && json.newBalance !== undefined) setDeposits(prev => ({ ...prev, [json.customerName]: json.newBalance }));
                                                        const histRes = await fetch(`${GAS_URL}?action=getDepositHistory`); const histJson = await histRes.json(); if (histJson.success) setDepositLogs(histJson.history);
                                                        showToast(`売上を ¥${val.toLocaleString()} に変更しました`);
                                                    } else { alert('エラー: ' + (json.message || '')); }
                                                } catch { alert('エラーが発生しました'); } finally { setIsSaving(false); setSavingMessage(null); }
                                            })();
                                        };
                                        const handleDeleteUsage = async (entry: typeof entriesWithBalance[0]) => {
                                            if (!confirm(`この利用履歴を削除しますか？\n\n${formatJSTDate(entry.date, true)} / ¥${entry.totalSales.toLocaleString()}\n\n※デポジット支払い済みの場合、残高に返還されます。`)) return;
                                            setIsSaving(true); setSavingMessage('削除中...');
                                            try {
                                                const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteReport', id: entry.reportId }) });
                                                const json = await res.json();
                                                if (json.success) {
                                                    setReports(prev => prev.filter(r => r.id !== entry.reportId));
                                                    if (json.customerName && json.newBalance !== undefined) setDeposits(prev => ({ ...prev, [json.customerName]: json.newBalance }));
                                                    const histRes = await fetch(`${GAS_URL}?action=getDepositHistory`); const histJson = await histRes.json(); if (histJson.success) setDepositLogs(histJson.history);
                                                    showToast('削除しました');
                                                } else { alert('エラー: ' + (json.message || '')); }
                                            } catch { alert('エラーが発生しました'); } finally { setIsSaving(false); setSavingMessage(null); }
                                        };
                                        const handleEditDeposit = (entry: typeof entriesWithBalance[0]) => {
                                            const newAmount = prompt(`金額を変更（現在: ¥${entry.amount.toLocaleString()}）`, String(entry.amount));
                                            if (newAmount === null) return;
                                            const val = Number(newAmount);
                                            if (isNaN(val)) { alert('有効な金額を入力してください'); return; }
                                            (async () => {
                                                setIsSaving(true); setSavingMessage('編集中...');
                                                try {
                                                    const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'editDepositHistory', date: entry.date, customerName: customer, customerPhone: customerPhoneForHistory, oldAmount: entry.amount, newAmount: val, type: (entry as any).rawType || entry.label }) });
                                                    const resJson = await res.json();
                                                    if (resJson.success) {
                                                        const histRes = await fetch(`${GAS_URL}?action=getDepositHistory`); const histJson = await histRes.json(); if (histJson.success) setDepositLogs(histJson.history);
                                                        if (resJson.newBalance !== undefined) setDeposits(prev => ({ ...prev, [customer]: resJson.newBalance }));
                                                        showToast(`金額を ¥${val.toLocaleString()} に変更しました`);
                                                    } else { alert('エラー: ' + (resJson.message || '')); }
                                                } catch { alert('エラーが発生しました'); } finally { setIsSaving(false); setSavingMessage(null); }
                                            })();
                                        };
                                        const handleDeleteDeposit = async (entry: typeof entriesWithBalance[0]) => {
                                            if (!confirm(`このデポジット履歴を削除しますか？\n\n${entry.label}: ¥${entry.amount.toLocaleString()}\n\n※残高は自動で調整されます。`)) return;
                                            setIsSaving(true); setSavingMessage('削除中...');
                                            try {
                                                const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteDepositHistory', date: entry.date, customerName: customer, customerPhone: customerPhoneForHistory, amount: entry.amount, type: (entry as any).rawType || entry.label }) });
                                                const resJson = await res.json();
                                                if (resJson.success) {
                                                    const histRes = await fetch(`${GAS_URL}?action=getDepositHistory`); const histJson = await histRes.json(); if (histJson.success) setDepositLogs(histJson.history);
                                                    if (resJson.newBalance !== undefined) setDeposits(prev => ({ ...prev, [customer]: resJson.newBalance }));
                                                    showToast('削除しました');
                                                } else { alert('削除に失敗: ' + (resJson.message || '')); }
                                            } catch { alert('エラーが発生しました'); } finally { setIsSaving(false); setSavingMessage(null); }
                                        };

                                        return (
                                            <div>
                                                <div className="bg-white dark:bg-gray-800 rounded border shadow-sm overflow-hidden">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-b dark:border-gray-700">
                                                            <tr>
                                                                <th className="px-3 py-2.5 text-xs font-semibold">日付</th>
                                                                <th className="px-3 py-2.5 text-xs font-semibold">項目</th>
                                                                <th className="px-3 py-2.5 text-xs font-semibold text-right text-blue-600">入金 (+)</th>
                                                                <th className="px-3 py-2.5 text-xs font-semibold text-right text-red-500">利用 (-)</th>
                                                                <th className="px-3 py-2.5 text-xs font-semibold text-right">残高</th>
                                                                <th className="px-3 py-2.5 text-xs font-semibold text-center w-20">操作</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {entriesWithBalance.length === 0 && (
                                                                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">履歴がありません</td></tr>
                                                            )}
                                                            {entriesWithBalance.map((entry, i) => {
                                                                const needsReview = (entry as any).needsReview as boolean;
                                                                const isBackfill = (entry as any).isBackfill as boolean;
                                                                const rowCls = needsReview
                                                                    ? 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-400'
                                                                    : isBackfill
                                                                        ? 'bg-gray-50/50 dark:bg-gray-900/20'
                                                                        : (entry.type === 'deposit' ? 'bg-blue-50/20 dark:bg-indigo-900/5' : '');
                                                                return (
                                                                <tr key={entry.id + '-' + i} className={`border-b dark:border-gray-700 hover:bg-gray-50/50 transition-colors ${rowCls}`}>
                                                                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatJSTDate(entry.date, true)}</td>
                                                                    <td className="px-3 py-2">
                                                                        {entry.type === 'usage' ? (
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${entry.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{entry.isPaid ? '利用(済)' : '利用(未払)'}</span>
                                                                                {(entry as any).paymentMethod && (
                                                                                    <span title={(entry as any).rawType} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${(entry as any).paymentMethodColor}`}>
                                                                                        {(entry as any).paymentMethod}
                                                                                    </span>
                                                                                )}
                                                                                {needsReview && (
                                                                                    <span title="過去分の自動補填行です。業務報告と履歴の紐付けを確認してください。" className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-yellow-100 text-yellow-700 border-yellow-300">⚠ 要確認</span>
                                                                                )}
                                                                                {isBackfill && !needsReview && (
                                                                                    <span title="過去データから自動補填された行です" className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-gray-100 text-gray-500 border-gray-300">過去分</span>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${entry.amount >= 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>{entry.label}</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right font-bold text-blue-600">
                                                                        {entry.creditAmount > 0 ? `+¥${entry.creditAmount.toLocaleString()}` : ''}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right font-bold text-red-500">
                                                                        {entry.debitAmount > 0 ? `-¥${entry.debitAmount.toLocaleString()}` : ''}
                                                                    </td>
                                                                    <td className={`px-3 py-2 text-right font-bold ${entry.balance < 0 ? 'text-red-600' : 'text-gray-800 dark:text-gray-200'}`}>
                                                                        ¥{entry.balance.toLocaleString()}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center whitespace-nowrap">
                                                                        {entry.type === 'usage' && entry.reportId && (
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                <button disabled={isSaving} onClick={() => handleEditUsage(entry)} className="text-blue-500 hover:text-blue-700 text-xs font-bold disabled:opacity-50">✏️</button>
                                                                                <button disabled={isSaving} onClick={() => handleDeleteUsage(entry)} className="text-red-500 hover:text-red-700 text-xs font-bold disabled:opacity-50">🗑️</button>
                                                                            </div>
                                                                        )}
                                                                        {entry.type === 'deposit' && (
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                <button disabled={isSaving} onClick={() => handleEditDeposit(entry)} className="text-blue-500 hover:text-blue-700 text-xs font-bold disabled:opacity-50">✏️</button>
                                                                                <button disabled={isSaving} onClick={() => handleDeleteDeposit(entry)} className="text-red-500 hover:text-red-700 text-xs font-bold disabled:opacity-50">🗑️</button>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <p className="text-[11px] text-gray-400 mt-2">※ 残高は帳簿残高（お客様との取引残高）です。<span className="text-indigo-600">正の値はデポジット残高</span>、<span className="text-red-600">負の値は未払い残高</span>を表します。最下行が現在の残高です。</p>
                                            </div>
                                        );
                                    })()}

                                    {/* 個別履歴タブ */}
                                    {historyTabMode === 'detail' && (() => {
                                        const detailCustomer = showHistoryForCustomer!;
                                        const detailPhone = reports.find(r => r.customerName === detailCustomer)?.customerPhone || customerList.find(c => c.name === detailCustomer)?.phone || '';
                                        const normalizedDetailPhone = normalizePhone(detailPhone);
                                        const filterDepositLogsByCustomer = (log: any) => {
                                            if (normalizedDetailPhone && log.customerPhone) return normalizePhone(log.customerPhone) === normalizedDetailPhone;
                                            return log.customerName === detailCustomer;
                                        };
                                        return <>

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
                                                        <th className="px-4 py-2 text-center">操作</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reports.filter(r => r.customerName === showHistoryForCustomer)
                                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                        .map(r => {
                                                            // サービス表示から「-> 計算XX分」を削除
                                                            const cleanServices = r.services.replace(/\s*->\s*計算\d+分/g, '').replace(/\((\d+)分\)/g, ' $1分');
                                                            return (
                                                                <tr key={r.id} className="border-b dark:border-gray-700 hover:bg-gray-50/50 dark:bg-gray-800/50">
                                                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatJSTDate(r.date, true)}</td>
                                                                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{r.staff}</td>
                                                                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{cleanServices}</td>
                                                                    <td className="px-4 py-3 text-right font-bold text-gray-700 dark:text-gray-300">¥{r.totalSales.toLocaleString()}</td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                            {r.isPaid ? '入金済' : '未入金'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <button
                                                                            disabled={isSaving}
                                                                            onClick={async () => {
                                                                                if (!confirm(`この利用履歴を削除しますか？\n\n${formatJSTDate(r.date, true)} / ¥${r.totalSales.toLocaleString()}\n\n※デポジットで支払い済みの場合、残高に自動で返還されます。`)) return;
                                                                                setIsSaving(true);
                                                                                setSavingMessage('履歴を削除中...');
                                                                                try {
                                                                                    const res = await fetch(GAS_URL, {
                                                                                        method: 'POST',
                                                                                        body: JSON.stringify({ action: 'deleteReport', id: r.id })
                                                                                    });
                                                                                    const json = await res.json();
                                                                                    if (json.success) {
                                                                                        setReports(prev => prev.filter(rep => rep.id !== r.id));
                                                                                        if (json.customerName && json.newBalance !== undefined) {
                                                                                            setDeposits(prev => ({ ...prev, [json.customerName]: json.newBalance }));
                                                                                        }
                                                                                        showToast('利用履歴を削除しました');
                                                                                    } else {
                                                                                        alert('エラー: ' + (json.message || '削除に失敗しました'));
                                                                                    }
                                                                                } catch (e) {
                                                                                    alert('エラーが発生しました');
                                                                                } finally {
                                                                                    setIsSaving(false);
                                                                                    setSavingMessage(null);
                                                                                }
                                                                            }}
                                                                            className="text-red-500 hover:text-red-700 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            🗑️ 削除
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    {reports.filter(r => r.customerName === showHistoryForCustomer).length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">通話のご利用履歴がありません</td>
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
                                                        <th className="px-4 py-2 text-center">削除</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {depositLogs.filter(filterDepositLogsByCustomer).map((log, i) => (
                                                        <tr key={i} className="border-b dark:border-gray-700 hover:bg-gray-50/50 dark:bg-gray-800/50">
                                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatJSTDate(log.date, true)}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.amount >= 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                    {log.type}
                                                                </span>
                                                            </td>
                                                            <td className={`px-4 py-3 text-right font-bold ${log.amount >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>
                                                                {log.amount >= 0 ? '+' : ''}¥{log.amount.toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-gray-200">¥{log.balance.toLocaleString()}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button
                                                                    disabled={isSaving}
                                                                    onClick={async () => {
                                                                        if (!confirm('この履歴を削除しますか？\n※残高の調整は手動で行ってください')) return;
                                                                        setIsSaving(true);
                                                                        setSavingMessage('履歴を削除中...');
                                                                        try {
                                                                            const res = await fetch(GAS_URL, {
                                                                                method: 'POST',
                                                                                body: JSON.stringify({
                                                                                    action: 'deleteDepositHistory',
                                                                                    date: log.date,
                                                                                    customerName: log.customerName,
                                                                                    customerPhone: log.customerPhone || detailPhone,
                                                                                    amount: log.amount,
                                                                                    type: log.type
                                                                                })
                                                                            });
                                                                            const resJson = await res.json();
                                                                            if (resJson.success) {
                                                                                setDepositLogs(prev => prev.filter((_, idx) => {
                                                                                    const filtered = prev.filter(filterDepositLogsByCustomer);
                                                                                    const originalIdx = prev.indexOf(filtered[i]);
                                                                                    return idx !== originalIdx;
                                                                                }));
                                                                                if (resJson.newBalance !== undefined && showHistoryForCustomer) {
                                                                                    setDeposits(prev => ({ ...prev, [showHistoryForCustomer]: resJson.newBalance }));
                                                                                }
                                                                            } else {
                                                                                alert('削除に失敗しました: ' + (resJson.message || ''));
                                                                            }
                                                                        } catch (e) {
                                                                            alert('エラーが発生しました');
                                                                        } finally {
                                                                            setIsSaving(false);
                                                                            setSavingMessage(null);
                                                                        }
                                                                    }}
                                                                    className="text-red-500 hover:text-red-700 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    🗑️ 削除
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {depositLogs.filter(filterDepositLogsByCustomer).length === 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">デポジットの履歴がありません</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* メモ履歴 */}
                                    <div>
                                        <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-1 inline-block">📝 スタッフメモ履歴</h4>
                                        {(() => {
                                            const memoReports = reports
                                                .filter(r => r.customerName === showHistoryForCustomer && r.memo && r.memo.trim())
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                            if (memoReports.length === 0) {
                                                return <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center bg-white dark:bg-gray-800 rounded border">メモの記録がありません</p>;
                                            }
                                            return (
                                                <div className="space-y-2">
                                                    {memoReports.map(r => (
                                                        <div key={r.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs text-gray-500 dark:text-gray-400">{formatJSTDate(r.date, true)}</span>
                                                                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">{r.staff}</span>
                                                            </div>
                                                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{r.memo}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    </>; })()}

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
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">マイページパスワード</label>
                                <input
                                    type="text"
                                    value={newCustomerData.password}
                                    onChange={(e) => setNewCustomerData({ ...newCustomerData, password: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                    placeholder="任意（後から設定も可能）"
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
                                    if (normalizePhone(newCustomerData.phone).length !== 11) {
                                        return alert('電話番号は11桁（ハイフンなし）で入力してください。');
                                    }
                                    setIsSaving(true);
                                    try {
                                        const normalizedPhone = normalizePhone(newCustomerData.phone);
                                        setDeposits(prev => ({ ...prev, [newCustomerData.name]: 0 }));
                                        setCustomerPhones(prev => ({ ...prev, [newCustomerData.name]: normalizedPhone }));
                                        await fetch(GAS_URL, {
                                            method: 'POST',
                                            body: JSON.stringify({
                                                action: 'addCustomer',
                                                customerName: newCustomerData.name,
                                                customerPhone: normalizedPhone,
                                                password: newCustomerData.password
                                            })
                                        });
                                        fetchDeposits();
                                        setNewCustomerData({ name: '', phone: '', password: '' });
                                        setShowAddCustomerModal(false);
                                    } catch (err) {
                                        console.error(err);
                                        alert('エラーが発生しました');
                                    } finally {
                                        setIsSaving(false);
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowChargeModal(false); setChargeTarget(null); setChargeTargetPhone(null); }}>
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
                                    還元後の合計: <span className="font-bold">¥{Math.floor(Number(chargeData.amount) * (1 + Number(chargeData.bonusRate) / 100)).toLocaleString()}</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => { setShowChargeModal(false); setChargeTarget(null); setChargeTargetPhone(null); }}
                                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={async () => {
                                    if (!chargeData.amount || Number(chargeData.amount) <= 0) {
                                        return alert('有効な金額を入力してください');
                                    }
                                    setIsSaving(true);
                                    setSavingMessage('チャージ処理中...画面を閉じないでお待ちください');
                                    try {
                                        const bonusAmount = Number(chargeData.amount) * (Number(chargeData.bonusRate) / 100);
                                        const totalAmount = Math.floor(Number(chargeData.amount) + bonusAmount);

                                        const chargeRes = await fetch(GAS_URL, {
                                            method: 'POST',
                                            redirect: 'follow',
                                            body: JSON.stringify({
                                                action: 'updateDeposit',
                                                type: 'charge',
                                                customerName: chargeTarget,
                                                customerPhone: normalizePhone(chargeTargetPhone || customerPhones[chargeTarget!] || customerList.find(c => c.name === chargeTarget)?.phone || ''),
                                                amount: totalAmount,
                                                rawAmount: Number(chargeData.amount),
                                                bonusRate: Number(chargeData.bonusRate)
                                            })
                                        });
                                        const resJson = await chargeRes.json();

                                        if (resJson.success && resJson.newBalance !== undefined) {
                                            setDeposits(prev => ({ ...prev, [chargeTarget]: resJson.newBalance }));
                                            // 自動精算があった場合、レポートを再取得して入金状況を反映
                                            if (resJson.autoSettled > 0) {
                                                fetchReports(false);
                                                showToast(`チャージ完了。未払い ¥${resJson.autoSettled.toLocaleString()} を自動精算しました`);
                                            } else {
                                                showToast('チャージが完了しました');
                                            }
                                        } else {
                                            setDeposits(prev => ({ ...prev, [chargeTarget]: (prev[chargeTarget] || 0) + totalAmount }));
                                        }
                                        setChargeData({ amount: '', bonusRate: bonusRate.toString() });
                                        setShowChargeModal(false);
                                        setChargeTarget(null);
                                        setChargeTargetPhone(null);
                                    } catch (err) {
                                        console.error(err);
                                        alert('エラーが発生しました');
                                    } finally {
                                        setIsSaving(false);
                                        setSavingMessage(null);
                                    }
                                }}
                                disabled={isSaving}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? '処理中...' : 'チャージする'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ローディング（保存中）UI */}
            {isSaving && (
                <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center z-[100]">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white mb-4"></div>
                    <p className="text-white font-bold tracking-wider">{savingMessage || '保存中...'}</p>
                </div>
            )}

            {/* トースト通知 */}
            {toastMessage && (
                <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
                    {toastMessage}
                </div>
            )}
        </div>
    );
}
