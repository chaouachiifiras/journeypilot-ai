package com.journeypilot.ai;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            // Ensure the WebView can take focus so that tapping a text field
            // inside it will raise the soft keyboard. Only set this up once;
            // avoid an OnTouchListener because per-touch requestFocus() calls
            // can interfere with Chromium's native gesture handling (scrolling,
            // button taps, etc.).
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            webView.requestFocus(View.FOCUS_DOWN);
        }
    }
}
