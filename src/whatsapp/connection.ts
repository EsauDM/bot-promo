import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import { handleMessage } from '../handlers/messageHandler';
import { initAutoPromo } from '../services/autoPromoService';

let flushInterval: NodeJS.Timeout | null = null;

export async function connectToWhatsApp() {
    if (flushInterval) clearInterval(flushInterval);

    // Gestão de estado do Baileys para não precisar ler o QR Code toda vez
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        // Limitando o uso de memória não salvando histórico
        getMessage: async () => { return undefined },
        logger: pino({ level: 'silent' }) as any,
        browser: Browsers.ubuntu('Chrome'), // Engana o WhatsApp dizendo que é o Chrome no Ubuntu
        generateHighQualityLinkPreview: false,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('--- SCAN THE QR CODE BELOW ---');
            qrcode.generate(qr, { small: true });
            console.log('------------------------------');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Motivo:', lastDisconnect?.error, 'Reconectar?', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ Conectado ao WhatsApp com sucesso!');
            // Inicia o Sniper de promoções automático
            initAutoPromo(sock);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        
        for (const msg of m.messages) {
            if (!msg.message || msg.key.fromMe) continue;
            await handleMessage(sock, msg);
        }
    });
    
    // Limpa a fila de eventos a cada hora para evitar memory leak
    flushInterval = setInterval(() => {
        sock.ev.flush();
    }, 60 * 60 * 1000); 

    return sock;
}
