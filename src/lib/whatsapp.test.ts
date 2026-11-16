import { describe, expect, it } from 'vitest';
import { whatsappInviteUrl } from './whatsapp';

describe('whatsappInviteUrl', () => {
  it('addresses the patient’s number, in digits only, with the app link in the message', () => {
    const url = new URL(whatsappInviteUrl({ name: 'Mr Rajesh Iyer', phone: '+919876543210' }, 'https://app.example/login'));
    expect(url.pathname).toBe('/919876543210');
    const text = url.searchParams.get('text')!;
    expect(text).toContain('Hello Rajesh,');
    expect(text).toContain('नमस्ते Rajesh,');
    expect(text).toContain('https://app.example/login');
  });

  it('tells them to sign in with their mobile number and a code from their doctor', () => {
    const text = new URL(whatsappInviteUrl({ name: 'Rajesh', phone: null }, 'https://app.example/login')).searchParams.get('text')!;
    expect(text).toContain('mobile number');
    expect(text).toContain('6-digit sign-in code');
    expect(text).toContain('मोबाइल नंबर');
    expect(text).not.toMatch(/email|ईमेल/);
  });

  it('leaves the recipient open when there is no phone number', () => {
    expect(new URL(whatsappInviteUrl({ name: 'Rajesh', phone: null }, 'https://app.example/login')).pathname).toBe('/');
  });
});
