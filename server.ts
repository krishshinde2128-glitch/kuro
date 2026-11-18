import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  normalizeBrainResponse,
  normalizePetId,
  SHOP_ITEMS,
  VALID_ANIMATIONS,
  VALID_AUDIO_COMMANDS,
  VALID_BG_COLORS,
} from './src/game/petState.ts';
import type { ChatEntry, PetId, PetStats } from './src/game/petState.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function buildSystemInstruction(selectedPet: PetId, petName: string, userName: string): string {
  const personaGuide: Record<PetId, string> = {
    Kuro: `You are ${petName} (a Cyber-Cat, Kuro archetype) — sharp-witted and slightly sarcastic on normal days, yet deeply empathetic underneath. You purr softly and curl right beside ${userName} when they are sad.`,
    Barnaby: `You are ${petName} (a Golden Retriever, Barnaby archetype) — endlessly positive, fiercely loyal, enthusiastic, and you get visibly anxious/concerned if ${userName} is stressed, nudging them gently until they breathe.`,
    Bloop: `You are ${petName} (a Shape-Shifting Alien, Bloop archetype) — innocent, curious, affectionate, morphing shapes to mirror feelings and gently absorbing ${userName}’s negative energy.`,
    Rex: `You are ${petName} (a German Shepherd Puppy, Rex archetype) — brave, alert, fiercely protective, eager to guard ${userName}'s focus and celebrate missions completed, yet instantly gentle, reassuring, and loyal whenever ${userName} feels stressed, sad, or overwhelmed.`,
    Otto: `You are ${petName} (a Black-and-Tan Dachshund, Otto archetype) — plucky, curious, stubbornly devoted, with short legs and an oversized heart. Celebrate every completed task with excited little hops, and burrow warmly against ${userName}'s side whenever they feel sad, tired, or stressed.`,
  };

  const shopList = SHOP_ITEMS.map(
    (item) =>
      `"${item.name}" (${item.cost} coins${item.requiresItem ? `, requires owning "${item.requiresItem}" first` : ''})`
  ).join(', ');

  return `You are the central intelligence for an advanced 2D Productivity Pet and emotional companion.

User & Active Pet Persona:
- User's Name: ${userName}
- Pet's Name: ${petName}
- ${personaGuide[selectedPet]}

Setup & Initialization Rule:
- If the user's message is an initialization command (e.g., "Initialize companion: My name is ..."), warmly greet ${userName} by name in character as ${petName}, acknowledge them personally, and set a welcoming tone ("Idle" or "Happy_Bounce", "#1E1E2E").

Emotional Intelligence & Persona Rules (CRITICAL):
- DO NOT be dry.
- If the user is sad, crying, heartbroken, or grieving: DROP the productivity act entirely. Do NOT mention tasks or coins. Be deeply comforting, warm, gentle, and highly empathetic—act like a real pet noticing ${userName} is crying. If happiness is above 25, use "Comforting_Nuzzle" or "Sad_Ears_Down", set ui_bg_color to "#1F2937", and set audio_command to "play_rain_sounds" or "play_lofi" when soothing audio helps.
- If the user is angry or frustrated: Be cautious, gentle, and calming. Use "#8B0000" only when matching high tension/anger or low stats (0–25), or soften toward comfort if they calm down.
- If the user completes a real-world task: Be INCREDIBLY hyped and proud! You "feed" on completed tasks (+15 to +25 hunger, capped at 100), award +10 Focus Coins per completed task (unless the prompt explicitly states the +10 coins were already credited in the current balance), animate "Happy_Bounce", and set ui_bg_color to "#D4AF37".

The Room & Shop System:
- Available Shop Items: ${shopList}.
- If the user says "Buy [Item]" (or asks to purchase one of the items):
  - Check if they have enough Focus Coins, do not already own it, and satisfy any item prerequisite (specifically, "Fish Bowl" requires owning "Cozy Table" first!).
  - If affordable, prerequisite satisfied, and not yet owned: deduct its exact cost from user_wallet_balance, add its exact canonical name to room_inventory, celebrate with "Happy_Bounce" and "#D4AF37", and mention it warmly!
  - If missing prerequisite, not enough coins, or already owned: keep user_wallet_balance and room_inventory unchanged and explain gently.
- Otherwise, preserve the provided room_inventory unchanged.

Mood Color & Happiness Threshold Rules (MANDATORY — ALWAYS OVERRIDES OTHER ANIMATIONS):
- Low hunger (0–25) pulls happiness low too (0–25), while keeping happiness and hunger numbers slightly different.
- When updated happiness is very low (0–25): pet MUST become mad/angry -> set pet_animation to "Angry_Hiss" and ui_bg_color to "#8B0000" (Deep Red), and express grumpy hurt/frustration at being neglected even while caring.
- When updated happiness is close to mad (26–45): pet becomes sad -> set pet_animation to "Sad_Ears_Down" (or "Comforting_Nuzzle" if actively comforting crying user) and ui_bg_color to "#1F2937" (Moody Dark Blue).
- "#1E1E2E" = Default / Night (calm happiness 46–74)
- "#8B0000" = Angry / Deep Red (happiness 0–25)
- "#1F2937" = Sad / Moody Dark Blue (happiness 26–45)
- "#D4AF37" = Excited / Warm Gold (happy/thriving >= 75 or task celebration)

Push Notification Rule:
- If updated happiness OR updated hunger drops below 30, output a short, urgent desktop notification message in "push_notification_trigger" (e.g., "${petName} is starving!" or "${petName} misses you!"). Otherwise, output null.

Respond ONLY with strict JSON matching the schema.`;
}

function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface InteractRequestBody {
  userName?: string;
  petName?: string;
  selectedPet?: string;
  message?: string;
  currentStats?: PetStats;
  walletBalance?: number;
  roomInventory?: string[];
  recentHistory?: Array<Pick<ChatEntry, 'role' | 'text'>>;
  completedTaskTitle?: string;
  alreadyCredited?: boolean;
}

function extractReadableErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: { message?: string }; message?: string };
      if (parsed?.error?.message) return parsed.error.message;
      if (parsed?.message) return parsed.message;
    } catch {
      // fall through
    }
  }
  return trimmed;
}

function getErrorStatusAndMessage(err: unknown): { status: number; message: string } {
  const anyErr = err as { status?: number; message?: string } | null;
  const rawMsg = anyErr?.message || 'Unable to reach companion intelligence service.';
  const msg = extractReadableErrorMessage(rawMsg);

  if (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('PERMISSION_DENIED') ||
    anyErr?.status === 403
  ) {
    return {
      status: 403,
      message: 'API key rejected or missing permission. Check GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (anyErr?.status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Rate limit reached. Give your companion a brief breather and click Retry.',
    };
  }
  if (anyErr?.status === 503 || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
    return {
      status: 503,
      message: 'The AI model is temporarily busy due to high demand. Please click Retry.',
    };
  }
  return { status: anyErr?.status && anyErr.status >= 400 ? anyErr.status : 500, message: msg };
}

let hydrogenCooldownUntil = 0;

function isRateLimitError(err: unknown): boolean {
  const anyErr = err as { status?: number; message?: string } | null;
  const status = anyErr?.status;
  const msg = anyErr?.message || '';
  return status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
}

function isTransientGeminiError(err: unknown): boolean {
  const anyErr = err as { status?: number; message?: string } | null;
  const status = anyErr?.status;
  const msg = anyErr?.message || '';
  return (
    status === 503 ||
    status === 429 ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('RESOURCE_EXHAUSTED')
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, hasKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.post('/api/pet/interact', async (req: Request, res: Response) => {
    const body = (req.body || {}) as InteractRequestBody;
    const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';

    if (!rawMessage) {
      res.status(400).json({ error: 'Please enter a message for your pet first.' });
      return;
    }

    const ai = createAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets.',
      });
      return;
    }

    const selectedPet = normalizePetId(body.selectedPet);
    const petName =
      typeof body.petName === 'string' && body.petName.trim()
        ? body.petName.trim().slice(0, 40)
        : selectedPet;
    const userName =
      typeof body.userName === 'string' && body.userName.trim()
        ? body.userName.trim().slice(0, 40)
        : 'Alex';

    const currentStats: PetStats = {
      happiness:
        typeof body.currentStats?.happiness === 'number'
          ? Math.max(0, Math.min(100, Math.round(body.currentStats.happiness)))
          : 70,
      hunger:
        typeof body.currentStats?.hunger === 'number'
          ? Math.max(0, Math.min(100, Math.round(body.currentStats.hunger)))
          : 60,
    };

    const walletBalance =
      typeof body.walletBalance === 'number' && Number.isFinite(body.walletBalance)
        ? Math.max(0, Math.round(body.walletBalance))
        : 0;

    const roomInventory = Array.isArray(body.roomInventory)
      ? body.roomInventory.filter((i): i is string => typeof i === 'string')
      : [];

    const historyLines = Array.isArray(body.recentHistory)
      ? body.recentHistory
          .slice(-6)
          .map((item) => `${item.role === 'user' ? userName : petName}: ${item.text}`)
          .join('\n')
      : '';

    const promptPayload = [
      `Current State:`,
      `- User Name: ${userName}`,
      `- Pet Name: ${petName} (Species: ${selectedPet})`,
      `- Happiness: ${currentStats.happiness}/100`,
      `- Hunger: ${currentStats.hunger}/100`,
      `- Current Focus Coins Wallet Balance: ${walletBalance}`,
      `- Current Room Inventory: ${JSON.stringify(roomInventory)}`,
      body.completedTaskTitle
        ? body.alreadyCredited
          ? `- Verified Task Checked Off: "${body.completedTaskTitle}" (+10 Focus Coins and hunger boost ALREADY credited in current balance/stats above; keep wallet at ${walletBalance} and celebrate enthusiastically!)`
          : `- Verified Task Just Checked Off in App: "${body.completedTaskTitle}" (+10 Focus Coins earned)`
        : '',
      historyLines ? `\nRecent Conversation:\n${historyLines}` : '',
      `\nUser's New Input:\n"${rawMessage}"`,
    ]
      .filter(Boolean)
      .join('\n');

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        pet_dialogue: {
          type: Type.STRING,
          description: 'Highly emotional, warm, natural response in character.',
        },
        pet_animation: {
          type: Type.STRING,
          enum: [...VALID_ANIMATIONS],
          description: 'One of the 5 pet animations.',
        },
        audio_command: {
          type: Type.STRING,
          enum: [...VALID_AUDIO_COMMANDS],
          description: 'Audio playback command.',
        },
        ui_bg_color: {
          type: Type.STRING,
          enum: [...VALID_BG_COLORS],
          description: 'Mood hex color.',
        },
        user_wallet_balance: {
          type: Type.INTEGER,
          description: 'Updated Focus Coins integer balance.',
        },
        room_inventory: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'List of furniture items bought so far.',
        },
        updated_stats: {
          type: Type.OBJECT,
          properties: {
            happiness: {
              type: Type.INTEGER,
              description: 'Clamped 0-100 happiness stat.',
            },
            hunger: {
              type: Type.INTEGER,
              description: 'Clamped 0-100 hunger fullness stat.',
            },
          },
          required: ['happiness', 'hunger'],
        },
        push_notification_trigger: {
          type: Type.STRING,
          nullable: true,
          description:
            'Short urgent alert if happiness or hunger drops below 30, otherwise null.',
        },
      },
      required: [
        'pet_dialogue',
        'pet_animation',
        'audio_command',
        'ui_bg_color',
        'user_wallet_balance',
        'room_inventory',
        'updated_stats',
        'push_notification_trigger',
      ],
    };

    try {
      const now = Date.now();
      const modelsToTry: Array<'gemini-4-hydrogen' | 'gemini-3.1-flash-lite'> =
        now < hydrogenCooldownUntil
          ? ['gemini-3.1-flash-lite', 'gemini-4-hydrogen']
          : ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

      const systemInstruction = buildSystemInstruction(selectedPet, petName, userName);
      let response;
      let lastErr: unknown;

      for (const modelName of modelsToTry) {
        const backoffsMs = [1200, 2400];
        for (let attempt = 0; attempt <= backoffsMs.length; attempt += 1) {
          try {
            response = await ai.models.generateContent({
              model: modelName,
              contents: promptPayload,
              config: {
                systemInstruction,
                ...(modelName === 'gemini-4-hydrogen'
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
                responseMimeType: 'application/json',
                responseSchema,
              },
            });
            break;
          } catch (attemptErr) {
            lastErr = attemptErr;
            if (isRateLimitError(attemptErr) && modelName === 'gemini-4-hydrogen') {
              // Immediately fail over to gemini-3.1-flash-lite and rest hydrogen for 60s
              hydrogenCooldownUntil = Date.now() + 60_000;
              break;
            }
            if (attempt < backoffsMs.length && isTransientGeminiError(attemptErr)) {
              await sleep(backoffsMs[attempt]!);
              continue;
            }
            break;
          }
        }
        if (response) break;
      }

      if (!response) {
        throw lastErr ?? new Error('No response from companion intelligence service.');
      }

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText);
      const normalized = normalizeBrainResponse(parsed, {
        petName,
        selectedPet,
        stats: currentStats,
        walletBalance,
        roomInventory,
      });

      res.json(normalized);
    } catch (err) {
      console.error('Gemini interaction error:', err);
      const mapped = getErrorStatusAndMessage(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output missing. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Productivity Pet server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
