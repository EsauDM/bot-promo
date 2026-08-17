import { proto } from '@whiskeysockets/baileys';
import { getActiveGroups, addGroup } from '../database/groupRepository';
import { generateAffiliateMessage, extractLink } from '../services/affiliateService';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_NUMBER = process.env.ADMIN_NUMBER + '@s.whatsapp.net';

export async function handleMessage(sock: any, msg: proto.IWebMessageInfo) {
    if (!msg.key) return;
    const getMessageText = (message: any): string => {
        if (!message) return '';
        if (message.conversation) return message.conversation;
        if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
        if (message.imageMessage?.caption) return message.imageMessage.caption;
        if (message.ephemeralMessage?.message) return getMessageText(message.ephemeralMessage.message);
        if (message.viewOnceMessageV2?.message) return getMessageText(message.viewOnceMessageV2.message);
        if (message.viewOnceMessage?.message) return getMessageText(message.viewOnceMessage.message);
        return '';
    };

    const sender = msg.key.remoteJid || '';
    const textMessage = getMessageText(msg.message);

    // Remove qualquer coisa que não seja número da ENV
    const adminNumber = process.env.ADMIN_NUMBER?.replace(/\D/g, '') || '0';
    // Pega os últimos 8 dígitos para ignorar a bagunça do 9º dígito no Brasil
    const adminFinal8 = adminNumber.slice(-8);

    // Helper para limpar o JID do WhatsApp (remove @s.whatsapp.net e remove o :ID do aparelho)
    const cleanNumber = (jid: string) => {
        const cleanJid = jid.split('@')[0].split(':')[0];
        return cleanJid.replace(/\D/g, '');
    };

    // Se for grupo, verifica se fomos adicionados
    if (sender.endsWith('@g.us')) {
        // Em grupos, o WhatsApp pode enviar a mensagem em modo LID escondendo o número real.
        // O número verdadeiro fica em participantAlt
        const keyAny = msg.key as any;
        const participant = keyAny.participantAlt || msg.key.participant || msg.participant || '';
        const participantRoot = cleanNumber(participant);

        // Comando para registrar grupo
        if (textMessage.trim() === '!registrar') {
             if (participantRoot.endsWith(adminFinal8)) {
                 const groupMetadata = await sock.groupMetadata(sender);
                 await addGroup(sender, groupMetadata.subject);
                 await sock.sendMessage(sender, { text: '✅ Grupo registrado para receber as promoções!' });
             } else {
                 console.log(`[IGNORADO] ${participantRoot} tentou registrar, mas não é admin.`);
             }
        }
        return;
    }

    // Comandos de Administrador (no privado do Bot)
    const senderRoot = cleanNumber(sender);
    if (senderRoot.endsWith(adminFinal8)) {
        if (textMessage.trim().startsWith('!oferta')) {
            const link = extractLink(textMessage);
            if (!link) {
                await sock.sendMessage(sender, { text: '❌ Nenhum link válido encontrado na sua mensagem.' });
                return;
            }

            // O formato será: !oferta https://link... | Nome do Produto | R$ 199,00 | R$ 99,00
            const parts = textMessage.split('|');
            const customTitle = parts.length > 1 ? parts[1].trim() : undefined;
            const oldPrice = parts.length > 2 ? parts[2].trim() : undefined;
            const newPrice = parts.length > 3 ? parts[3].trim() : undefined;

            try {
                await sock.sendMessage(sender, { text: '⏳ Processando e enviando oferta...' });
                const promoMessage = await generateAffiliateMessage(link, customTitle, oldPrice, newPrice);
                
                const activeGroups = await getActiveGroups();
                let successCount = 0;
                
                // Helper para extrair a mídia corretamente mesmo se for mensagem temporária
                const getImageMessage = (message: any): any => {
                    if (!message) return null;
                    if (message.imageMessage) return message.imageMessage;
                    if (message.ephemeralMessage?.message) return getImageMessage(message.ephemeralMessage.message);
                    if (message.viewOnceMessageV2?.message) return getImageMessage(message.viewOnceMessageV2.message);
                    if (message.viewOnceMessage?.message) return getImageMessage(message.viewOnceMessage.message);
                    return null;
                };

                let imageBuffer = null;
                const imgMsg = getImageMessage(msg.message);
                
                if (imgMsg) {
                    try {
                        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                        imageBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: undefined });
                    } catch (e) {
                        console.error('Erro ao baixar imagem:', e);
                    }
                }

                for (const groupId of activeGroups) {
                    try {
                        if (imageBuffer) {
                            await sock.sendMessage(groupId, { image: imageBuffer, caption: promoMessage });
                        } else {
                            await sock.sendMessage(groupId, { text: promoMessage });
                        }
                        successCount++;
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (err) {
                        console.error(`Erro ao enviar para o grupo ${groupId}:`, err);
                    }
                }

                await sock.sendMessage(sender, { text: `✅ Oferta enviada com sucesso para ${successCount}/${activeGroups.length} grupos!` });
            } catch (error) {
                console.error(error);
                await sock.sendMessage(sender, { text: '❌ Erro ao gerar ou enviar a oferta.' });
            }
        } else {
            await sock.sendMessage(sender, { text: '🤖 *Comandos do Bot:*\n\nEnvie `!oferta <link_do_produto>` para disparar em todos os grupos registrados.' });
        }
    }
}
