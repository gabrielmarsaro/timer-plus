# Timer Plus

Timer de treino HIIT/Tabata para **Android, iPhone, tablet e navegador**.

## Modos

| Aba | Função |
|-----|--------|
| **Tabata** | Preparar / exercício / descanso com foco na fase ativa |
| **Rondas** | Timer de rounds (boxe/MMA) |
| **Cronómetro** | Contagem crescente com voltas/intervalos |
| **Mais** | Configurações, atalhos e instalação |

## iPhone (Safari)

**https://unstable-seed-8pbdp7z.shipstatic.com**

1. Abra no **Safari**.  
2. Desative o **mute lateral** e aumente o volume.  
3. **Compartilhar** → **Adicionar à Tela de Início**.

## Android (APK) — versão **1.3.0**

**https://raw.githubusercontent.com/gabrielmarsaro/timer-plus/af7e24e95e7d2d18b187f5d02115789be7f91f54/releases/timer-plus-debug.apk**

1. Baixe no Chrome.  
2. Permita **fontes desconhecidas** se pedir.  
3. Instale / atualize.

Se der erro de pacote/assinatura: desinstale o app antigo e instale de novo.

Página de download: https://unstable-seed-8pbdp7z.shipstatic.com/baixar.html

## Música Tabata

- **YouTube** (padrão): ao iniciar o treino, o app abre um player com vídeos públicos de Tabata (ex.: compilação de músicas). Também dá para abrir no app YouTube. Não baixamos o áudio.
- **Batidas offline**: ritmo próprio do app (Pulse / Drive / Storm) sem internet.
- Com “Respeitar música”, se outra app estiver tocando, o timer fica só com alertas de início/fim.

## Entrega em todas as plataformas

Toda mudança do app deve atualizar **código + web/iPhone + APK** no mesmo ciclo. Ver `AGENTS.md`.

## Desenvolvimento

```bash
npm install
npm run dev
npm run build:docs
npm run android:apk
npm run smoke
node scripts/smoke-focus.mjs
node scripts/smoke-stopwatch.mjs
node scripts/smoke-music.mjs
```
