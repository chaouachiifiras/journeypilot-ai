package com.journeypilot.ai;

import android.os.Bundle;

import com.facebook.appevents.AppEventsConstants;
import com.facebook.appevents.AppEventsLogger;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.math.BigDecimal;
import java.util.Currency;
import java.util.Iterator;

/**
 * Forwards the app's key funnel events to Meta (Facebook) App Events so the Meta app-install
 * campaign can see what happens after the install. Installs and app opens themselves are
 * logged automatically by the SDK (AutoLogAppEventsEnabled in the manifest).
 */
@CapacitorPlugin(name = "MetaEvents")
public class MetaEventsPlugin extends Plugin {

    private AppEventsLogger logger;

    @Override
    public void load() {
        logger = AppEventsLogger.newLogger(getContext());
    }

    @PluginMethod
    public void logEvent(PluginCall call) {
        String name = call.getString("name");
        if (name == null || name.isEmpty()) {
            call.reject("Missing event name");
            return;
        }
        JSObject params = call.getObject("params", new JSObject());

        try {
            if ("purchase".equals(name)) {
                Double value = params.has("value") ? params.getDouble("value") : null;
                String currency = params.getString("currency");
                if (value != null && currency != null) {
                    logger.logPurchase(BigDecimal.valueOf(value), Currency.getInstance(currency), toBundle(params));
                    call.resolve();
                    return;
                }
            }
            logger.logEvent(metaName(name), toBundle(params));
            call.resolve();
        } catch (Exception e) {
            // Analytics must never break the flow it measures.
            call.resolve();
        }
    }

    /** Maps our Firebase-style names to Meta's standard events where one exists. */
    private static String metaName(String name) {
        switch (name) {
            case "login_success":
                return AppEventsConstants.EVENT_NAME_COMPLETED_REGISTRATION;
            case "planner_started":
                return AppEventsConstants.EVENT_NAME_COMPLETED_TUTORIAL;
            default:
                return name; // e.g. trip_generated, login_prompt_shown: custom events
        }
    }

    private static Bundle toBundle(JSObject params) {
        Bundle bundle = new Bundle();
        Iterator<String> keys = params.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object v = params.opt(key);
            if (v instanceof Number) {
                bundle.putDouble(key, ((Number) v).doubleValue());
            } else if (v != null) {
                bundle.putString(key, String.valueOf(v));
            }
        }
        return bundle;
    }
}
