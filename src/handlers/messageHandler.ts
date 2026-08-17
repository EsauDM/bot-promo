import { proto } from '@whiskeysockets/baileys';
import { getActiveGroups, addGroup } from '../database/groupRepository';
import { generateAffiliateMessage, extractLink } from '../services/affiliateService';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_NUMBER = process.env.ADMIN_NUMBER + '@s.whatsapp.net';

export async function handleMessage(sock: any, msg: proto.IWebMessageInfo) {
    if (!msg.key) return;
    const sender = msg.key.remoteJid;
    const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    // Se for grupo, verifica se fomos adicionados
    if (sender?.endsWith('@g.us')) {
        // Comando para registrar grupo (Admin digita "!registrar" dentro do grupo)
        if (textMessage === '!registrar' && msg.participant === ADMIN_NUMBER) {
             const groupMetadata = await sock.groupMetadata(sender);
             await addGroup(sender, groupMetadata.subject);
             await sock.sendMessage(sender, { text: '✅ Grupo registrado para receber as promoções!' });
        }
        return;
    }

    // Comandos de Administrador (no privado do Bot)
    if (sender === ADMIN_NUMBER) {
        if (textMessage.startsWith('!oferta')) {
            const link = extractLink(textMessage);
            if (!link) {
                await sock.sendMessage(sender, { text: '❌ Nenhum link válido encontrado na sua mensagem.' });
                return;
            }

            try {
                await sock.sendMessage(sender, { text: '⏳ Processando e enviando oferta...' });
                const promoMessage = await generateAffiliateMessage(link);
                
                const activeGroups = await getActiveGroups();
                let successCount = 0;

                for (const groupId of activeGroups) {
                    try {
                        await sock.sendMessage(groupId, { text: promoMessage });
                        successCount++;
                        // Pequeno delay para evitar ban do WhatsApp (Anti-Spam)
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
            // Echo help
            await sock.sendMessage(sender, { text: '🤖 *Comandos do Bot:*\n\nEnvie `!oferta <link_do_produto>` para disparar em todos os grupos registrados.' });
        }
    }
}
