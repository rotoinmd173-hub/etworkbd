import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  balance: number;
  coins: number;
  rank: number;
  referral_code: string | null;
  referred_by: string | null;
  kyc_status: 'none' | 'pending' | 'verified' | 'rejected';
  is_admin: boolean;
  created_at: string;
}

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, balance, coins, rank, referral_code, referred_by, kyc_status, is_admin, created_at')
    .maybeSingle();
  if (error) return null;
  return data as Profile | null;
}

export async function upsertProfile(id: string, full_name: string, email: string) {
  return supabase
    .from('profiles')
    .upsert({ id, full_name, email }, { onConflict: 'id' });
}

// ---------- Referral ----------
export interface ReferralRow {
  id: string;
  referrer_id: string;
  referee_id: string;
  referrer_coins: number;
  referee_coins: number;
  status: string;
  created_at: string;
  referee_name?: string;
}

export async function applyReferralCode(code: string, refereeId: string) {
  const { data, error } = await supabase.rpc('apply_referral', {
    p_code: code.trim(),
    p_referee: refereeId,
  });
  if (error) return { success: false as const, message: error.message };
  return data as { success: boolean; message: string };
}

export async function fetchMyReferrals(): Promise<ReferralRow[]> {
  const { data, error } = await supabase
    .from('referrals')
    .select('id, referrer_id, referee_id, referrer_coins, referee_coins, status, created_at')
    .or(`referrer_id.eq.${(await supabase.auth.getUser()).data.user?.id}`)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const enriched = await Promise.all(
    data.map(async (r) => {
      const { data: referee } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', r.referee_id)
        .maybeSingle();
      return { ...r, referee_name: referee?.full_name ?? 'New User' };
    })
  );
  return enriched as ReferralRow[];
}

export async function fetchReferralsAsReferrer(): Promise<ReferralRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from('referrals')
    .select('id, referrer_id, referee_id, referrer_coins, referee_coins, status, created_at')
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const enriched = await Promise.all(
    data.map(async (r) => {
      const { data: referee } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', r.referee_id)
        .maybeSingle();
      return { ...r, referee_name: referee?.full_name ?? 'New User' };
    })
  );
  return enriched as ReferralRow[];
}

// ---------- KYC ----------
export interface KycSubmission {
  id: string;
  user_id: string;
  full_name: string;
  id_type: string;
  id_number: string;
  country: string;
  address: string;
  date_of_birth: string;
  gender: string;
  id_front_img: string;
  id_back_img: string;
  selfie_img: string;
  status: 'pending' | 'verified' | 'rejected';
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export async function submitKyc(input: Omit<KycSubmission, 'id' | 'user_id' | 'status' | 'admin_note' | 'reviewed_at' | 'created_at'>) {
  return supabase.from('kyc_submissions').insert(input).select().maybeSingle();
}

export async function fetchMyKyc(): Promise<KycSubmission | null> {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as KycSubmission | null;
}

// ---------- Support ----------
export interface SupportTicket {
  id: string;
  user_id: string;
  user_name: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender: string;
  body: string;
  is_admin: boolean;
  created_at: string;
}

export async function createTicket(subject: string, firstMessage: string, userName: string): Promise<SupportTicket | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({ user_id: userId, subject, user_name: userName })
    .select()
    .maybeSingle();
  if (error || !ticket) return null;

  const { error: messageError } = await supabase.from('support_messages').insert({
    ticket_id: ticket.id,
    sender_id: userId,
    sender: userName,
    body: firstMessage,
    is_admin: false,
  });
  if (messageError) return null;
  return ticket as SupportTicket;
}

export async function fetchMyTickets(): Promise<SupportTicket[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data as SupportTicket[];
}

export async function fetchMessages(ticketId: string): Promise<SupportMessage[]> {
  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as SupportMessage[];
}

export async function sendMessage(ticketId: string, body: string, userName: string) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: new Error('Not signed in') };
  return supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_id: userId,
    sender: userName,
    body,
    is_admin: false,
  });
}

// ---------- Ratings ----------
export async function submitRating(stars: number, comment: string, userName: string) {
  return supabase.from('app_ratings').insert({ stars, comment, user_name: userName });
}

// ---------- Notices ----------
export interface Notice {
  id: string;
  title: string;
  body: string;
  active: boolean;
  created_at: string;
}

export async function fetchActiveNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notices')
    .select('id, title, body, active, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Notice[];
}

export async function fetchAllNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notices')
    .select('id, title, body, active, created_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Notice[];
}

export async function createNotice(title: string, body: string): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('notices').insert({ title: title.trim(), body: body.trim() });
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'নোটিশ প্রকাশিত হয়েছে।' };
}

export async function toggleNoticeActive(id: string, active: boolean): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('notices').update({ active }).eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: active ? 'নোটিশ সক্রিয় করা হয়েছে।' : 'নোটিশ লুকানো হয়েছে।' };
}

export async function deleteNotice(id: string): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('notices').delete().eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'নোটিশ মুছে ফেলা হয়েছে।' };
}

// ---------- Admin helpers ----------
export interface AdminKycRow extends KycSubmission {}

export async function adminFetchAllKyc(): Promise<AdminKycRow[]> {
  const { data, error } = await supabase.rpc('admin_list_kyc');
  if (error || !data) return [];
  return data as AdminKycRow[];
}

export async function adminReviewKyc(id: string, status: 'verified' | 'rejected', note: string) {
  const { data, error } = await supabase.rpc('admin_review_kyc', {
    p_id: id,
    p_status: status,
    p_note: note,
  });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export interface AdminTicketRow {
  id: string;
  user_id: string;
  user_name: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_at: string | null;
}

export async function adminFetchTickets(): Promise<AdminTicketRow[]> {
  const { data, error } = await supabase.rpc('admin_list_tickets');
  if (error || !data) return [];
  return data as AdminTicketRow[];
}

export async function adminReply(ticketId: string, body: string) {
  const { data, error } = await supabase.rpc('admin_reply', {
    p_ticket: ticketId,
    p_body: body,
  });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export async function adminFetchTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as SupportMessage[];
}
