import ReportForm from '@/components/ReportForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50/50 pt-10 pb-20 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* ヘッダーエリア */}
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-[#1c1c1e] tracking-tight">ハナシタラ.com</h1>
          <p className="text-sm text-gray-500 font-medium">スタッフ専用ポータル</p>
        </header>

        {/* 業務報告フォームの読み込み */}
        <main>
          <ReportForm />
        </main>

        <footer className="text-center pt-8 border-t border-gray-200/60 text-xs text-gray-400">
          <p>© 2026 ハナシタラ.com All Rights Reserved.</p>
        </footer>
      </div>
    </div>
  );
}
