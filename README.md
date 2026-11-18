# Timer Plus

Timer de treino HIIT/Tabata para **celular, tablet e Android** (instalação por APK / fontes desconhecidas).

## Rodar no navegador

```bash
npm install
npm run dev
```

## Android — instalar sem Play Store

O app é empacotado com Capacitor. Você gera um **APK** e instala no Android com a opção
**Instalar apps de fontes desconhecidas** (ou “Permitir desta fonte”).

### 1. Gerar o APK

Requisitos: **JDK 17+** e **Android SDK**.

```bash
npm install
npm run android:apk
```

Arquivo gerado:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### 2. Instalar no celular / tablet

1. Envie o `app-debug.apk` para o aparelho (cabo, Drive, WhatsApp, e-mail…).
2. Abra o arquivo no Android.
3. Se o sistema bloquear, ative **Instalar apps desconhecidos** para o app que está abrindo o APK (Arquivos, Chrome, Drive, etc.).
4. Confirme a instalação e abra **Timer Plus**.

Não precisa da Play Store. O APK de debug serve para uso pessoal e testes.

## Layout

| Dispositivo | Comportamento |
|-------------|---------------|
| Celular | UI compacta, números grandes, alto contraste |
| Tablet | Tipografia maior, blocos com respiro |
| Tablet landscape | Fase atual e próxima **lado a lado** |

## Scripts

| Comando | Função |
|---------|--------|
| `npm run dev` | Servidor web local |
| `npm run build` | Build web (`dist/`) |
| `npm run cap:sync` | Build + sincroniza Capacitor Android |
| `npm run android:apk` | Gera o APK debug |

## Estrutura

- `src/` — app React (Tabata, settings, navegação)
- `android/` — projeto nativo Capacitor
- `capacitor.config.ts` — id `com.timerplus.app`
