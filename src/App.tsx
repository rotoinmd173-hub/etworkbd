import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { BottomNav, type TabKey } from '@/components/BottomNav';
import { HomeView } from '@/views/HomeView';
import { WorkView } from '@/views/WorkView';
import { CreateView } from '@/views/CreateView';
import { WalletView, ProfileView, WithdrawView } from '@/views/WalletView';
import { DepositView } from '@/views/DepositView';
import { AdminView } from '@/views/AdminView';
import { AuthView } from '@/views/AuthView';
import { ReferralView } from '@/views/ReferralView';
import { VerificationView } from '@/views/VerificationView';
import { SupportView } from '@/views/SupportView';
import { MyCreatedWork, MySubmissions } from '@/views/MyWorkView';
import { InfoModal, type ModalKind } from '@/views/InfoModals';
import type { SideMenuDestination } from '@/components/SideNavDrawer';
import { Loader2 } from 'lucide-react';

type Screen = TabKey | 'deposit' | 'withdraw' | 'admin' | 'referral' | 'verification' | 'support' | 'my-created' | 'my-submissions';

function App() {
  const { session, profile, loading } = useAuth();
  const [tab, setTab] = useState<Screen>('home');
  const [modal, setModal] = useState<ModalKind>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  const go = (t: string) => setTab(t as Screen);
  const displayName = profile?.full_name ?? 'User';

  const onSideMenuNavigate = (dest: SideMenuDestination) => {
    if (dest === 'profile') { setTab('profile'); return; }
    if (dest === 'referral') { setTab('referral'); return; }
    if (dest === 'verification') { setTab('verification'); return; }
    if (dest === 'support') { setTab('support'); return; }
    if (dest === 'share') { setModal('share'); return; }
    if (dest === 'rate') { setModal('rate'); return; }
    if (dest === 'terms') { setModal('terms'); return; }
    if (dest === 'privacy') { setModal('privacy'); return; }
    if (dest === 'about') { setModal('about'); return; }
  };

  const showBottomNav = tab !== 'deposit' && tab !== 'withdraw' && tab !== 'admin' && tab !== 'referral' && tab !== 'verification' && tab !== 'support' && tab !== 'my-created' && tab !== 'my-submissions';

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-slate-100 pb-24">
      {tab === 'home' && <HomeView go={go} userName={displayName} profile={profile} onSideMenuNavigate={onSideMenuNavigate} />}
      {tab === 'work' && <WorkView />}
      {tab === 'create' && <CreateView />}
      {tab === 'wallet' && <WalletView go={(t) => setTab(t as Screen)} profile={profile} />}
      {tab === 'profile' && <ProfileView goAdmin={() => setTab('admin')} profile={profile} />}
      {tab === 'deposit' && <DepositView onBack={() => setTab('wallet')} />}
      {tab === 'withdraw' && <WithdrawView onBack={() => setTab('wallet')} />}
      {tab === 'admin' && <AdminView onExit={() => setTab('profile')} />}
      {tab === 'referral' && <ReferralView onBack={() => setTab('home')} profile={profile} />}
      {tab === 'verification' && <VerificationView onBack={() => setTab('home')} />}
      {tab === 'support' && <SupportView onBack={() => setTab('home')} profile={profile} />}
      {tab === 'my-created' && <MyCreatedWork onBack={() => setTab('home')} />}
      {tab === 'my-submissions' && <MySubmissions onBack={() => setTab('home')} />}

      {showBottomNav && <BottomNav active={tab as TabKey} onChange={(t) => setTab(t)} />}

      <InfoModal kind={modal} onClose={() => setModal(null)} profile={profile} />
    </div>
  );
}

export async function logout() {
  await supabase.auth.signOut();
}

export default App;
