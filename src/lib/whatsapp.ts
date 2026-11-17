import { firstName } from './format';

/**
 * A wa.me link with the app invitation ready to send from the doctor's own WhatsApp. With no phone
 * number on file, WhatsApp asks who to send it to. The text carries no health details and no sign-in
 * code: the doctor gives the code separately.
 */
export const whatsappInviteUrl = (patient: { name: string; phone: string | null }, appUrl: string) => {
  const name = firstName(patient.name);
  const text = [
    `Hello ${name}, your care team has set up the Fit for Surgery app for you: ${appUrl}`,
    'Open the link and sign in with your mobile number, then ask your doctor for your 6-digit sign-in code.',
    '',
    `नमस्ते ${name}, आपकी देखभाल टीम ने आपके लिए Fit for Surgery ऐप शुरू किया है: ${appUrl}`,
    'लिंक खोलें और अपने मोबाइल नंबर से साइन इन करें, फिर अपने डॉक्टर से 6 अंकों का साइन-इन कोड लें।',
  ].join('\n');
  return `https://wa.me/${patient.phone?.replace(/\D/g, '') ?? ''}?text=${encodeURIComponent(text)}`;
};
