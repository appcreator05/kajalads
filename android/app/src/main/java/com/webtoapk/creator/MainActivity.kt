package com.webtoapk.creator

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import org.json.JSONObject
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.*
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.io.FileOutputStream

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var loadingSpinner: ProgressBar
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var targetBaseHost: String = ""
    private var targetBaseUrl: String = ""

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val data = result.data
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
            fileUploadCallback?.onReceiveValue(uris)
        } else {
            fileUploadCallback?.onReceiveValue(null)
        }
        fileUploadCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            initApp()
        } catch (e: Throwable) {
            Toast.makeText(this, "Starting APK Creator: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    override fun onResume() {
        super.onResume()
        try {
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            if (::webView.isInitialized) {
                webView.keepScreenOn = true
            }
        } catch (_: Exception) {}
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun initApp() {
        // Hide default action bar safely
        supportActionBar?.hide()

        // Keep screen always ON - prevents device display from sleeping during compilation, build and downloads
        try {
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } catch (_: Exception) {}

        // Read app_config.json if packaged in assets
        var appTitle = "AppCreator05"
        var websiteUrl = ""
        var isFullScreen = false
        var splashDurationMs = 2500L

        try {
            val isConfig = assets.open("app_config.json")
            val jsonStr = isConfig.bufferedReader().use { it.readText() }
            isConfig.close()
            val json = JSONObject(jsonStr)
            if (json.has("appName") && json.optString("appName").isNotBlank()) {
                appTitle = json.optString("appName")
            }
            if (json.has("websiteUrl") && json.optString("websiteUrl").isNotBlank()) {
                websiteUrl = json.optString("websiteUrl").trim()
                targetBaseUrl = websiteUrl
                try {
                    targetBaseHost = Uri.parse(websiteUrl).host?.lowercase() ?: ""
                } catch (_: Exception) {}
            }
            if (json.has("fullscreenMode")) {
                isFullScreen = json.optBoolean("fullscreenMode", false)
            }
            if (json.has("splashDuration")) {
                splashDurationMs = (json.optDouble("splashDuration", 2.5) * 1000).toLong()
            }
        } catch (_: Exception) {}

        // Fullscreen configuration:
        // AppCreator05 and standard web apps are NOT forced to fullscreen!
        // System status bar and navigation bar remain visible unless user explicitly enabled Full Screen in config.
        if (isFullScreen) {
            try {
                WindowCompat.setDecorFitsSystemWindows(window, false)
                val controller = WindowInsetsControllerCompat(window, window.decorView)
                controller.hide(WindowInsetsCompat.Type.systemBars())
                controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } catch (_: Exception) {}
        } else {
            try {
                WindowCompat.setDecorFitsSystemWindows(window, true)
                val controller = WindowInsetsControllerCompat(window, window.decorView)
                controller.show(WindowInsetsCompat.Type.systemBars())
            } catch (_: Exception) {}
        }

        val rootLayout = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            keepScreenOn = true
        }

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            keepScreenOn = true
        }
        rootLayout.addView(webView)

        // Native central loading spinner / spring:
        // Displays prominently in the center of the screen when navigating between pages
        loadingSpinner = ProgressBar(this).apply {
            val pSize = (56 * resources.displayMetrics.density).toInt()
            layoutParams = FrameLayout.LayoutParams(pSize, pSize, Gravity.CENTER)
            isIndeterminate = true
            indeterminateTintList = ColorStateList.valueOf(Color.parseColor("#0ea5e9"))
            elevation = 25f
            visibility = View.GONE
        }
        rootLayout.addView(loadingSpinner)

        // Native Splash Overlay with custom Logo & Splash Background
        val splashView = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#070b19"))
            elevation = 30f
        }

        // Try to load custom splash background from assets or resources
        val splashBgImageView = ImageView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            scaleType = ImageView.ScaleType.CENTER_CROP
        }
        var hasSplashBg = false
        try {
            val isSplash = assets.open("splash_image.png")
            val bmp = BitmapFactory.decodeStream(isSplash)
            isSplash.close()
            if (bmp != null) {
                splashBgImageView.setImageBitmap(bmp)
                hasSplashBg = true
            }
        } catch (_: Exception) {}
        if (!hasSplashBg) {
            try {
                val isSplash = assets.open("splash_bg.png")
                val bmp = BitmapFactory.decodeStream(isSplash)
                isSplash.close()
                if (bmp != null) {
                    splashBgImageView.setImageBitmap(bmp)
                    hasSplashBg = true
                }
            } catch (_: Exception) {}
        }
        if (!hasSplashBg) {
            try {
                splashBgImageView.setImageResource(R.drawable.splash_image)
                hasSplashBg = true
            } catch (_: Exception) {}
        }
        if (hasSplashBg) {
            splashView.addView(splashBgImageView)
        }

        val splashContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            )
        }

        val logoImageView = ImageView(this).apply {
            val size = (100 * resources.displayMetrics.density).toInt()
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                bottomMargin = (18 * resources.displayMetrics.density).toInt()
            }
            setImageResource(R.mipmap.ic_launcher)
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        // Try to load custom logo from assets if present
        try {
            val isLogo = assets.open("app_logo.png")
            val bmp = BitmapFactory.decodeStream(isLogo)
            isLogo.close()
            if (bmp != null) {
                logoImageView.setImageBitmap(bmp)
            }
        } catch (_: Exception) {}
        splashContent.addView(logoImageView)

        val appTitleView = TextView(this).apply {
            text = appTitle
            setTextColor(Color.WHITE)
            textSize = 22f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = (24 * resources.displayMetrics.density).toInt()
            }
        }
        splashContent.addView(appTitleView)

        val splashSpinner = ProgressBar(this).apply {
            val pSize = (34 * resources.displayMetrics.density).toInt()
            layoutParams = LinearLayout.LayoutParams(pSize, pSize)
            isIndeterminate = true
            indeterminateTintList = ColorStateList.valueOf(Color.parseColor("#0ea5e9"))
        }
        splashContent.addView(splashSpinner)

        splashView.addView(splashContent)
        rootLayout.addView(splashView)

        setContentView(rootLayout)

        var splashDismissed = false
        fun dismissSplash() {
            if (splashDismissed) return
            splashDismissed = true
            splashView.animate()
                .alpha(0f)
                .setDuration(400)
                .withEndAction {
                    splashView.visibility = View.GONE
                    try {
                        rootLayout.removeView(splashView)
                    } catch (_: Exception) {}
                }
                .start()
        }

        // Safety fallback: auto-dismiss after configured splash duration
        Handler(Looper.getMainLooper()).postDelayed({
            dismissSplash()
        }, splashDurationMs)

        setupWebViewSettings()
        setupDownloadListener()

        // Secure WebViewAssetLoader: enables ES modules, CORS, and local storage without crashes
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                loadingSpinner.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                loadingSpinner.visibility = View.GONE
                dismissSplash()
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                loadingSpinner.visibility = View.GONE
                // If local assets fail to load, automatically fall back to live cloud URL
                if (request?.isForMainFrame == true && request.url.toString().contains("appassets.androidplatform.net")) {
                    webView.post {
                        webView.loadUrl("https://ais-pre-gxyvg3phkakhlvxkyoqcx7-32286104148.asia-southeast1.run.app")
                    }
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false

                // 1. If it's an ad URL -> open in Google Chrome (target="_blank")
                if (isAdUrl(url)) {
                    openCustomTab(url)
                    return true
                }

                // 2. Local app assets (AppCreator05 internal files)
                if (url.startsWith("https://appassets.androidplatform.net")) {
                    return false
                }

                // 3. External schemes (tel:, mailto:, intent:, etc.)
                val uri = request.url
                val scheme = uri?.scheme?.lowercase() ?: ""
                if (scheme != "http" && scheme != "https") {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        startActivity(intent)
                        return true
                    } catch (_: Exception) {
                        return true
                    }
                }

                // 4. Target website URL domain check:
                // If a target website URL is configured and this URL does not belong to that website,
                // open in Google Chrome (target="_blank")
                val reqHost = uri.host?.lowercase() ?: ""
                if (targetBaseHost.isNotBlank()) {
                    val isInternal = reqHost == targetBaseHost ||
                                     reqHost.endsWith(".$targetBaseHost") ||
                                     targetBaseHost.endsWith(".$reqHost")
                    if (!isInternal) {
                        openCustomTab(url)
                        return true
                    }
                }

                return false
            }
        }

        if (websiteUrl.isNotBlank()) {
            webView.loadUrl(websiteUrl)
        } else {
            // Test if bundled web assets exist
            val hasLocalAssets = try {
                assets.open("web/index.html").close()
                true
            } catch (e: Exception) {
                false
            }

            if (hasLocalAssets) {
                webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
            } else {
                webView.loadUrl("https://ais-pre-gxyvg3phkakhlvxkyoqcx7-32286104148.asia-southeast1.run.app")
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebViewSettings() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = false
        settings.loadWithOverviewMode = true
        settings.textZoom = 100
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.setSupportMultipleWindows(true)
        settings.javaScriptCanOpenWindowsAutomatically = true

        // Register Native Android Bridge for Direct Downloads and Custom Tabs
        val bridge = AndroidBridge()
        webView.addJavascriptInterface(bridge, "AndroidBridge")
        webView.addJavascriptInterface(bridge, "AndroidDownloader")
        webView.addJavascriptInterface(bridge, "AndroidApp")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                if (newProgress < 100) {
                    loadingSpinner.visibility = View.VISIBLE
                } else {
                    loadingSpinner.visibility = View.GONE
                }
            }

            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message?
            ): Boolean {
                val hrefMsg = view?.handler?.obtainMessage()
                view?.requestFocusNodeHref(hrefMsg)
                val directUrl = hrefMsg?.data?.getString("url")
                if (!directUrl.isNullOrBlank()) {
                    openCustomTab(directUrl)
                    return false
                }

                val newWebView = WebView(this@MainActivity).apply {
                    this.settings.javaScriptEnabled = true
                    this.settings.domStorageEnabled = true
                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(v: WebView?, req: WebResourceRequest?): Boolean {
                            val target = req?.url?.toString() ?: return false
                            openCustomTab(target)
                            return true
                        }

                        override fun onPageStarted(v: WebView?, target: String?, favicon: Bitmap?) {
                            super.onPageStarted(v, target, favicon)
                            if (!target.isNullOrBlank() && target != "about:blank") {
                                openCustomTab(target)
                            }
                        }
                    }
                }

                val transport = resultMsg?.obj as? WebView.WebViewTransport
                transport?.webView = newWebView
                resultMsg?.sendToTarget()
                return true
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                }
                try {
                    fileChooserLauncher.launch(intent)
                } catch (e: Exception) {
                    fileUploadCallback = null
                    return false
                }
                return true
            }
        }
    }

    private fun setupDownloadListener() {
        webView.setDownloadListener { url, _, contentDisposition, mimetype, _ ->
            if (url.startsWith("data:")) {
                handleDataUrlDownload(url, contentDisposition, mimetype)
            } else if (url.startsWith("blob:")) {
                // Fetch blob inside WebView JS context and pass base64 to native bridge
                val js = """
                    (async function() {
                        try {
                            const res = await fetch('$url');
                            const blob = await res.blob();
                            const reader = new FileReader();
                            reader.onloadend = function() {
                                if (window.AndroidDownloader) {
                                    window.AndroidDownloader.saveBase64File(
                                        reader.result,
                                        'apk-creator-app.apk',
                                        blob.type || 'application/vnd.android.package-archive'
                                    );
                                }
                            };
                            reader.readAsDataURL(blob);
                        } catch(err) {
                            console.error('Blob conversion failed', err);
                        }
                    })();
                """.trimIndent()
                webView.evaluateJavascript(js, null)
            } else {
                try {
                    val request = DownloadManager.Request(Uri.parse(url)).apply {
                        setMimeType(mimetype)
                        setDescription("Downloading via APK Creator...")
                        setTitle(URLUtil.guessFileName(url, contentDisposition, mimetype))
                        setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        setDestinationInExternalPublicDir(
                            Environment.DIRECTORY_DOWNLOADS,
                            URLUtil.guessFileName(url, contentDisposition, mimetype)
                        )
                    }
                    val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                    dm.enqueue(request)
                    Toast.makeText(this, "Download started...", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    // Fallback to Chrome Custom Tabs
                    openCustomTab(url)
                }
            }
        }
    }

    /**
     * Opens Chrome Custom Tabs with modern app toolbar styling
     */
    fun openCustomTab(url: String) {
        val trimmed = url.trim()
        if (trimmed.isBlank()) return
        try {
            val uri = Uri.parse(trimmed)
            val primaryColor = Color.parseColor("#0ea5e9")
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .setDefaultColorSchemeParams(
                    CustomTabColorSchemeParams.Builder()
                        .setToolbarColor(primaryColor)
                        .setNavigationBarColor(primaryColor)
                        .build()
                )
                .build()

            // Specifically target Google Chrome as requested
            try {
                customTabsIntent.intent.setPackage("com.android.chrome")
            } catch (_: Exception) {}

            customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            customTabsIntent.launchUrl(this, uri)
        } catch (e: Exception) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(trimmed)).apply {
                    setPackage("com.android.chrome")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(intent)
            } catch (errChrome: Exception) {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(trimmed)).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(intent)
                } catch (err: Exception) {
                    Toast.makeText(this, "Cannot open browser: ${err.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    /**
     * Saves raw bytes into the public Downloads directory on all Android versions
     */
    fun saveBytesToDownloads(fileBytes: ByteArray, requestedFileName: String, mimeType: String): File? {
        val fileName = if (requestedFileName.isNotBlank()) requestedFileName else "apk-creator-app.apk"
        var resultFile: File? = null

        // 1. Direct write to public Downloads folder (/storage/emulated/0/Download/)
        try {
            val publicDownloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!publicDownloadsDir.exists()) {
                publicDownloadsDir.mkdirs()
            }
            val targetFile = File(publicDownloadsDir, fileName)
            FileOutputStream(targetFile).use { outputStream ->
                outputStream.write(fileBytes)
                outputStream.flush()
            }
            if (targetFile.exists() && targetFile.length() > 0) {
                resultFile = targetFile

                // Scan file so it shows up in media store and all file managers
                MediaScannerConnection.scanFile(
                    this,
                    arrayOf(targetFile.absolutePath),
                    arrayOf(mimeType),
                    null
                )

                // Register with system DownloadManager so it appears in notification & Downloads app
                try {
                    val dm = getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
                    dm?.addCompletedDownload(
                        fileName,
                        "Downloaded by APK Creator",
                        true,
                        mimeType,
                        targetFile.absolutePath,
                        targetFile.length(),
                        true
                    )
                } catch (ignored: Exception) {}
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 2. In Android 10+ (Q+), also publish via MediaStore.Downloads with IS_PENDING = 0
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val resolver = contentResolver
                // Delete previous file with same name to avoid collisions
                try {
                    resolver.delete(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                        "${MediaStore.MediaColumns.DISPLAY_NAME} = ?",
                        arrayOf(fileName)
                    )
                } catch (ignored: Exception) {}

                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                if (uri != null) {
                    resolver.openOutputStream(uri, "rwt")?.use { outputStream ->
                        outputStream.write(fileBytes)
                        outputStream.flush()
                    }
                    contentValues.clear()
                    contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                    resolver.update(uri, contentValues, null, null)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // 3. Fallback app-private cache directory for FileProvider
        val fallbackFile = try {
            val fallbackDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: filesDir
            val file = File(fallbackDir, fileName)
            FileOutputStream(file).use { it.write(fileBytes) }
            file
        } catch (e: Exception) {
            null
        }

        return resultFile ?: fallbackFile
    }

    /**
     * Prompts the native Android Package Installer to install the generated APK
     */
    fun promptInstallApk(file: File) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!packageManager.canRequestPackageInstalls()) {
                    val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                        data = Uri.parse("package:$packageName")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(intent)
                    val appLabel = applicationInfo.loadLabel(packageManager).toString()
                    Toast.makeText(this, "Please allow 'Install unknown apps' to install $appLabel", Toast.LENGTH_LONG).show()
                    return
                }
            }
            val uri = FileProvider.getUriForFile(
                this,
                "$packageName.fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "Saved to Downloads: ${file.name}", Toast.LENGTH_LONG).show()
        }
    }

    private fun handleDataUrlDownload(dataUrl: String, contentDisposition: String, mimetype: String) {
        try {
            val commaIndex = dataUrl.indexOf(",")
            if (commaIndex != -1) {
                val base64Data = dataUrl.substring(commaIndex + 1)
                val decodedBytes = Base64.decode(base64Data, Base64.DEFAULT)
                var fileName = URLUtil.guessFileName(dataUrl, contentDisposition, mimetype)
                if (fileName.isNullOrBlank() || fileName == "downloadfile.bin") {
                    fileName = "my_web_app-release.apk"
                }
                val targetMime = if (mimetype.isNotBlank() && mimetype != "application/octet-stream") mimetype else "application/vnd.android.package-archive"
                val savedFile = saveBytesToDownloads(decodedBytes, fileName, targetMime)
                if (savedFile != null) {
                    Toast.makeText(this, "Downloaded to Downloads: $fileName", Toast.LENGTH_LONG).show()
                    if (fileName.endsWith(".apk", ignoreCase = true)) {
                        promptInstallApk(savedFile)
                    }
                }
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Download error: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    /**
     * JavaScript interface exposed to the Web App running inside WebView
     */
    inner class AndroidBridge {
        @JavascriptInterface
        fun saveBase64File(base64Data: String, fileName: String, mimeType: String) {
            Thread {
                try {
                    val cleanBase64 = if (base64Data.contains(",")) {
                        base64Data.substringAfter(",")
                    } else {
                        base64Data
                    }
                    val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                    val targetMime = if (mimeType.isNotBlank()) mimeType else "application/vnd.android.package-archive"
                    val savedFile = saveBytesToDownloads(bytes, fileName, targetMime)

                    runOnUiThread {
                        if (savedFile != null) {
                            Toast.makeText(
                                this@MainActivity,
                                "✅ Downloaded to Downloads folder: $fileName",
                                Toast.LENGTH_LONG
                            ).show()
                        } else {
                            Toast.makeText(this@MainActivity, "Failed to save: $fileName", Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "Save error: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                    }
                }
            }.start()
        }

        @JavascriptInterface
        fun installDownloadedApk(fileName: String) {
            runOnUiThread {
                try {
                    val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                    val targetFile = File(downloadsDir, fileName)
                    if (targetFile.exists()) {
                        promptInstallApk(targetFile)
                    } else {
                        val fallbackDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: filesDir
                        val fallbackFile = File(fallbackDir, fileName)
                        if (fallbackFile.exists()) {
                            promptInstallApk(fallbackFile)
                        } else {
                            Toast.makeText(this@MainActivity, "File not found: $fileName", Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Install error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface
        fun openInCustomTabs(url: String) {
            runOnUiThread {
                val trimmed = url.trim()
                if (trimmed.isNotBlank() && trimmed != "#" && !trimmed.startsWith("#") && !trimmed.startsWith("blob:") && !trimmed.startsWith("data:")) {
                    openCustomTab(trimmed)
                }
            }
        }

        @JavascriptInterface
        fun openAdLink(url: String) {
            runOnUiThread {
                val trimmed = url.trim()
                if (trimmed.isNotBlank()) {
                    openCustomTab(trimmed)
                }
            }
        }

        @JavascriptInterface
        fun showInterstitial() {
            // Native interstitial bridge
        }

        @JavascriptInterface
        fun showRewarded() {
            // Native rewarded bridge
        }

        @JavascriptInterface
        fun downloadUrl(url: String) {
            runOnUiThread {
                if (url.isNotBlank()) {
                    openCustomTab(url)
                }
            }
        }

        @JavascriptInterface
        fun openDownloadsFolder() {
            runOnUiThread {
                try {
                    val intent = Intent(DownloadManager.ACTION_VIEW_DOWNLOADS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    try {
                        val downloadsPath = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).path
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(Uri.parse(downloadsPath), "*/*")
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        startActivity(intent)
                    } catch (err: Exception) {
                        Toast.makeText(
                            this@MainActivity,
                            "ফাইলটি আপনার ফোনের Internal Storage > Download ফোল্ডারে আছে",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }
        }

        @JavascriptInterface
        fun isNativeApp(): Boolean {
            return true
        }

        @JavascriptInterface
        fun exitApp() {
            runOnUiThread {
                finish()
            }
        }

        @JavascriptInterface
        fun canGoBack(): Boolean {
            return webView.canGoBack()
        }

        @JavascriptInterface
        fun goBack() {
            runOnUiThread {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        }

        @JavascriptInterface
        fun reload() {
            runOnUiThread {
                webView.reload()
            }
        }
    }

    private fun isAdUrl(url: String): Boolean {
        val lower = url.lowercase()
        return lower.contains("googleads") ||
               lower.contains("doubleclick.net") ||
               lower.contains("adservice.google") ||
               lower.contains("pagead2") ||
               lower.contains("adclick") ||
               lower.contains("ad_click") ||
               lower.contains("clickserve") ||
               lower.contains("startappservice") ||
               lower.contains("startapp.com") ||
               lower.contains("applovin.com") ||
               lower.contains("unityads") ||
               lower.contains("adnxs.com") ||
               lower.contains("amazon-adsystem") ||
               lower.contains("taboola.com") ||
               lower.contains("outbrain.com") ||
               lower.contains("adcolony") ||
               lower.contains("vungle") ||
               lower.contains("ironsrc") ||
               lower.contains("criteo") ||
               lower.contains("admob") ||
               lower.contains("pubads") ||
               lower.contains("smartadserver") ||
               lower.contains("adroll")
    }
}
