import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-[240px] transition-all duration-300">
        <TopBar />
        <main className="p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>
    </div>
  );
}
