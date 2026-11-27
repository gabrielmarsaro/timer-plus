package com.timerplus.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Temporarily ducks other music apps (Spotify etc.) for beeps / spoken cues,
 * then abandons focus so the previous music returns to full volume.
 */
@CapacitorPlugin(name = "AudioDuck")
public class AudioDuckPlugin extends Plugin {

    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private AudioManager.OnAudioFocusChangeListener focusListener;
    private TextToSpeech tts;
    private final AtomicBoolean ttsReady = new AtomicBoolean(false);
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private int duckHoldCount = 0;

    @Override
    public void load() {
        super.load();
        Context context = getContext();
        if (context == null) {
            return;
        }
        audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        focusListener = focusChange -> {
            // Transient duck only — nothing to pause on our side.
        };
        tts = new TextToSpeech(
            context,
            status -> {
                ttsReady.set(status == TextToSpeech.SUCCESS);
                if (!ttsReady.get() || tts == null) {
                    return;
                }
                try {
                    tts.setLanguage(new Locale("pt", "BR"));
                    tts.setAudioAttributes(
                        new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    );
                } catch (Exception ignored) {
                    // ignore
                }
            }
        );
    }

    @Override
    protected void handleOnDestroy() {
        forceUnduck();
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {
                // ignore
            }
            tts = null;
        }
        super.handleOnDestroy();
    }

    private synchronized boolean requestDuckInternal() {
        if (audioManager == null) {
            return false;
        }
        duckHoldCount += 1;
        if (duckHoldCount > 1) {
            return true;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();
                focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(attrs)
                    .setOnAudioFocusChangeListener(focusListener, mainHandler)
                    .setAcceptsDelayedFocusGain(false)
                    .setWillPauseWhenDucked(false)
                    .build();
                int result = audioManager.requestAudioFocus(focusRequest);
                return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
            }
            @SuppressWarnings("deprecation")
            int result = audioManager.requestAudioFocus(
                focusListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            );
            return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        } catch (Exception ex) {
            duckHoldCount = Math.max(0, duckHoldCount - 1);
            return false;
        }
    }

    private synchronized void unduckInternal() {
        if (audioManager == null) {
            return;
        }
        if (duckHoldCount <= 0) {
            return;
        }
        duckHoldCount -= 1;
        if (duckHoldCount > 0) {
            return;
        }
        abandonFocus();
    }

    private synchronized void forceUnduck() {
        duckHoldCount = 0;
        abandonFocus();
    }

    private void abandonFocus() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
                audioManager.abandonAudioFocusRequest(focusRequest);
                focusRequest = null;
            } else if (focusListener != null) {
                @SuppressWarnings("deprecation")
                int ignored = audioManager.abandonAudioFocus(focusListener);
            }
        } catch (Exception ignored) {
            // ignore
        }
    }

    @PluginMethod
    public void duck(PluginCall call) {
        boolean granted = requestDuckInternal();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void unduck(PluginCall call) {
        unduckInternal();
        call.resolve();
    }

    @PluginMethod
    public void beep(PluginCall call) {
        final double freq = call.getDouble("frequency", 880.0);
        final int durationMs = Math.max(40, Math.min(1200, call.getInt("durationMs", 160)));
        final float volume = (float) Math.max(0.05, Math.min(1.0, call.getDouble("volume", 0.7)));

        getBridge()
            .execute(
                () -> {
                    boolean granted = requestDuckInternal();
                    try {
                        playTone((float) freq, durationMs, volume);
                    } catch (Exception ignored) {
                        // ignore
                    }
                    mainHandler.postDelayed(
                        () -> {
                            unduckInternal();
                            JSObject ret = new JSObject();
                            ret.put("granted", granted);
                            call.resolve(ret);
                        },
                        durationMs + 60
                    );
                }
            );
    }

    @PluginMethod
    public void speak(PluginCall call) {
        final String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.resolve();
            return;
        }

        mainHandler.post(
            () -> {
                final AtomicBoolean finished = new AtomicBoolean(false);
                final Runnable finish = () -> {
                    if (!finished.compareAndSet(false, true)) {
                        return;
                    }
                    unduckInternal();
                    try {
                        call.resolve();
                    } catch (Exception ignored) {
                        // already resolved
                    }
                };

                if (tts == null || !ttsReady.get()) {
                    requestDuckInternal();
                    mainHandler.postDelayed(finish, 700);
                    return;
                }

                requestDuckInternal();
                final String utteranceId = "timer-viking-" + System.currentTimeMillis();
                tts.setOnUtteranceProgressListener(
                    new UtteranceProgressListener() {
                        @Override
                        public void onStart(String id) {}

                        @Override
                        public void onDone(String id) {
                            mainHandler.post(finish);
                        }

                        @Override
                        public void onError(String id) {
                            mainHandler.post(finish);
                        }
                    }
                );

                Bundle params = new Bundle();
                params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
                int result = tts.speak(text, TextToSpeech.QUEUE_ADD, params, utteranceId);
                if (result != TextToSpeech.SUCCESS) {
                    finish.run();
                    return;
                }
                mainHandler.postDelayed(finish, Math.max(2800, text.length() * 140));
            }
        );
    }

    private void playTone(float frequency, int durationMs, float volume) {
        int sampleRate = 22050;
        int samples = Math.max(1, (sampleRate * durationMs) / 1000);
        short[] buffer = new short[samples];
        for (int i = 0; i < samples; i++) {
            double t = i / (double) sampleRate;
            double env = Math.min(1.0, i / 180.0) * Math.min(1.0, (samples - i) / 320.0);
            double sample = Math.sin(2 * Math.PI * frequency * t) * env * volume;
            buffer[i] = (short) (sample * Short.MAX_VALUE);
        }

        AudioFormat format = new AudioFormat.Builder()
            .setSampleRate(sampleRate)
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
            .build();

        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        int minBuf = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        );
        int bufSize = Math.max(minBuf, samples * 2);

        AudioTrack track = new AudioTrack.Builder()
            .setAudioAttributes(attrs)
            .setAudioFormat(format)
            .setBufferSizeInBytes(bufSize)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build();

        track.write(buffer, 0, buffer.length);
        track.play();
        mainHandler.postDelayed(
            () -> {
                try {
                    track.stop();
                    track.release();
                } catch (Exception ignored) {
                    // ignore
                }
            },
            durationMs + 80
        );
    }
}
