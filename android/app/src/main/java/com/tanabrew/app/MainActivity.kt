package com.tanabrew.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Base64
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import java.io.File
import java.io.FileOutputStream

class MainActivity : AppCompatActivity() {

    companion object {
        const val PRODUCTION_URL = "https://tanabrew-stok-and-invoice.vercel.app/"
        const val NOTIFICATION_CHANNEL_ID = "tanabrew_alerts"
    }

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var errorLayout: View
    private lateinit var btnRetry: Button

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var lastBackPressedTime: Long = 0

    // Launcher Dialog Izin Resmi Android (Notifikasi & Kamera saat pertama buka)
    private val requestPermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val notifGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions[Manifest.permission.POST_NOTIFICATIONS] ?: false
        } else {
            true
        }
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false

        if (notifGranted) {
            notifyWebNotificationPermissionChanged("granted")
        }
    }

    // Launcher File Chooser (Upload foto struk / bukti pembayaran dari kamera atau galeri)
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            val results: Array<Uri>? = when {
                data?.dataString != null -> arrayOf(Uri.parse(data.dataString))
                data?.clipData != null -> {
                    val clip = data.clipData!!
                    Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                }
                else -> null
            }
            fileUploadCallback?.onReceiveValue(results)
        } else {
            fileUploadCallback?.onReceiveValue(null)
        }
        fileUploadCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. OPTIMASI PERFORMA & AKSELERASI GPU: 120Hz & Zero Stutter
        window.setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        )

        // 2. LAYAR KASIR STANDBY: Layar tidak mati otomatis saat kasir melayani transaksi
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // 3. Background bersih selaras dengan logo HD Tanabrew
        window.setBackgroundDrawableResource(R.color.white)

        setContentView(R.layout.activity_main)

        createNotificationChannel()
        initViews()
        setupWebView()
        setupBackNavigation()
        checkAndRequestInitialPermissions()

        if (savedInstanceState == null) {
            loadApp()
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Notifikasi Tanabrew",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Pemberitahuan stok, pesanan kasir, dan obrolan tim Tanabrew"
                enableVibration(true)
                enableLights(true)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun checkAndRequestInitialPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }

        if (permissionsToRequest.isNotEmpty()) {
            requestPermissionsLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    private fun initViews() {
        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        progressBar = findViewById(R.id.progressBar)
        errorLayout = findViewById(R.id.errorLayout)
        btnRetry = findViewById(R.id.btnRetry)

        // Indikator pull-to-refresh warna hijau Tanabrew
        swipeRefresh.setColorSchemeColors(
            ContextCompat.getColor(this, R.color.tanabrew_green),
            0xFF1B5E20.toInt(),
            0xFF4CAF50.toInt()
        )
        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }

        // HARMONI SENTUHAN (ZERO LAG):
        // Jangan pernah cegat sentuhan jika halaman sedang di-scroll ke bawah!
        swipeRefresh.setOnChildScrollUpCallback { _, _ ->
            webView.scrollY > 0
        }

        btnRetry.setOnClickListener {
            errorLayout.visibility = View.GONE
            webView.visibility = View.VISIBLE
            loadApp()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        // Akselerasi layer GPU murni pada WebView
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false

        // Anti-blok teks seleksi browser (mencegah pop-up 'Salin/Pilih Semua' browser saat tombol ditahan)
        webView.isLongClickable = false
        webView.setOnLongClickListener { true }

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true

        // Mode cache cerdas: menghormati ETag & Hash Vite dari Vercel
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(false)
        settings.displayZoomControls = false
        settings.builtInZoomControls = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true

        // Prioritas render engine WebKit tinggi
        @Suppress("DEPRECATION")
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH)

        // Keamanan: Tolak konten campuran tak aman
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

        // User Agent khusus Android Wrapper
        settings.userAgentString = "${settings.userAgentString} TanabrewAndroidApp/1.1"

        // Persistensi Cookie & Sesi
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        // Jembatan Native (Print, WhatsApp Direct Share, dan Notifikasi)
        webView.addJavascriptInterface(AndroidNativeBridge(this), "AndroidBridge")
        webView.addJavascriptInterface(AndroidNativeBridge(this), "AndroidPrint")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false

                // Intersepsi WhatsApp Intent: wa.me, api.whatsapp.com, whatsapp://
                if (url.startsWith("https://wa.me/") ||
                    url.startsWith("https://api.whatsapp.com/") ||
                    url.startsWith("whatsapp://")
                ) {
                    return handleExternalIntent(url)
                }

                // Intersepsi Telepon, Email, SMS, dan PlayStore
                if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("sms:") || url.startsWith("market:")) {
                    return handleExternalIntent(url)
                }

                // Domain eksternal
                val host = request.url.host ?: ""
                if (!host.contains("tanabrew") && !host.contains("vercel.app") && !host.contains("firebase")) {
                    return handleExternalIntent(url)
                }

                return false
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
                errorLayout.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                CookieManager.getInstance().flush()

                // Injeksi Script Native Harmony:
                // 1. Polyfill window.Notification agar web membaca push didukung
                // 2. Intersepsi window.print() ke Android PrintManager
                // 3. Intersepsi tombol WA di tab Riwayat agar melampirkan PDF langsung ke WhatsApp
                // 4. Mencegah seleksi teks biru browser pada tombol & kartu
                injectNativePolyfills(view)
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                    if (!isNetworkAvailable()) {
                        webView.visibility = View.GONE
                        errorLayout.visibility = View.VISIBLE
                    }
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                // Berikan izin otomatis untuk fitur web yang diminta (audio, video, protected media)
                request?.grant(request.resources)
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
                    addCategory(Intent.CATEGORY_OPENABLE)
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

        webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, contentLength ->
            handleDownload(url, contentDisposition, mimeType)
        })
    }

    private fun injectNativePolyfills(view: WebView?) {
        val script = """
            (function() {
                if (window.__tanabrewNativeInjected) return;
                window.__tanabrewNativeInjected = true;
                window.isAndroidApp = true;

                // 1. Anti-Blok Teks Seleksi Browser
                var style = document.createElement('style');
                style.innerHTML = '* { -webkit-tap-highlight-color: transparent; } button, nav, .tanabrew-card-enter, [role="button"] { -webkit-touch-callout: none !important; -webkit-user-select: none !important; user-select: none !important; }';
                document.head.appendChild(style);

                // 2. Polyfill window.Notification & Web Push Support
                var currentPermission = (window.AndroidBridge && window.AndroidBridge.getNotificationPermission) 
                    ? window.AndroidBridge.getNotificationPermission() 
                    : "granted";

                function NativeNotification(title, options) {
                    options = options || {};
                    var body = options.body || "";
                    if (window.AndroidBridge && window.AndroidBridge.showNotification) {
                        window.AndroidBridge.showNotification(title, body);
                    }
                }
                NativeNotification.permission = currentPermission;
                NativeNotification.requestPermission = function(callback) {
                    return new Promise(function(resolve) {
                        if (window.AndroidBridge && window.AndroidBridge.requestNotificationPermission) {
                            window.AndroidBridge.requestNotificationPermission();
                        }
                        var res = "granted";
                        if (callback) callback(res);
                        resolve(res);
                    });
                };

                if (!window.Notification || window.Notification.permission === 'unsupported' || window.Notification.permission === 'denied') {
                    window.Notification = NativeNotification;
                }

                // 3. Intersepsi window.print()
                window.print = function() {
                    if (window.AndroidBridge && window.AndroidBridge.printDocument) {
                        window.AndroidBridge.printDocument();
                    }
                };

                // 4. Intersepsi Aksi Bagikan Dokumen PDF Faktur ke WhatsApp
                document.addEventListener('click', function(e) {
                    var target = e.target;
                    var shareBtn = target.closest('button');
                    if (!shareBtn) return;
                    
                    var btnText = (shareBtn.innerText || '').trim();
                    if (btnText.includes('Buka Dokumen PDF & Bagikan') || btnText.includes('Buka Chat WhatsApp')) {
                        // Cari textarea rincian teks pesan jika modal terbuka
                        var textarea = document.querySelector('textarea');
                        var caption = textarea ? textarea.value : '';
                        
                        // Cari input telepon tujuan
                        var phoneInput = document.querySelector('input[type="tel"]');
                        var phone = phoneInput ? phoneInput.value : '';

                        if (window.AndroidBridge && window.AndroidBridge.onWhatsAppShareRequested) {
                            window.AndroidBridge.onWhatsAppShareRequested(caption, phone);
                        }
                    }
                }, true);
            })();
        """.trimIndent()
        view?.evaluateJavascript(script, null)
    }

    private fun notifyWebNotificationPermissionChanged(status: String) {
        runOnUiThread {
            webView.evaluateJavascript(
                "if (window.Notification) { window.Notification.permission = '$status'; }",
                null
            )
        }
    }

    private fun loadApp() {
        if (!isNetworkAvailable()) {
            webView.visibility = View.GONE
            errorLayout.visibility = View.VISIBLE
            return
        }
        webView.visibility = View.VISIBLE
        errorLayout.visibility = View.GONE
        webView.loadUrl(PRODUCTION_URL)
    }

    private fun handleExternalIntent(url: String): Boolean {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            return true
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "Aplikasi pendukung tidak ditemukan di HP Anda.", Toast.LENGTH_SHORT).show()
            return true
        } catch (e: Exception) {
            return false
        }
    }

    private fun handleDownload(url: String, contentDisposition: String?, mimeType: String?) {
        try {
            if (url.startsWith("data:")) {
                val base64Data = url.substringAfter("base64,")
                val decodedBytes = Base64.decode(base64Data, Base64.DEFAULT)
                val fileName = "Tanabrew_Invoice_${System.currentTimeMillis()}.pdf"
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val file = File(downloadsDir, fileName)
                FileOutputStream(file).use { it.write(decodedBytes) }
                Toast.makeText(this, "File tersimpan di Downloads: $fileName", Toast.LENGTH_LONG).show()
                return
            }

            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mimeType)
                addRequestHeader("User-Agent", webView.settings.userAgentString)
                setDescription("Mengunduh dokumen Tanabrew...")
                setTitle(URLUtil.guessFileName(url, contentDisposition, mimeType))
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(
                    Environment.DIRECTORY_DOWNLOADS,
                    URLUtil.guessFileName(url, contentDisposition, mimeType)
                )
            }
            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
            Toast.makeText(this, "Mengunduh file faktur...", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Gagal mengunduh: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Cek apakah sedang menampilkan halaman cetak faktur/laporan
                webView.evaluateJavascript("(function() { return Boolean(document.querySelector('.print-toolbar')); })()") { isPrint ->
                    if (isPrint == "true") {
                        webView.evaluateJavascript(
                            "if (typeof kembaliTanabrew === 'function') { kembaliTanabrew(); } else if (typeof tanabrewBack === 'function') { tanabrewBack(); } else { window.location.href = '/riwayat'; }",
                            null
                        )
                    } else if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        val currentTime = System.currentTimeMillis()
                        if (currentTime - lastBackPressedTime < 2000) {
                            finish()
                        } else {
                            lastBackPressedTime = currentTime
                            Toast.makeText(this@MainActivity, "Tekan sekali lagi untuk keluar dari Tanabrew", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
        })
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    // Jembatan Native: Print, WhatsApp Direct PDF Share, Notifikasi
    class AndroidNativeBridge(private val activity: MainActivity) {

        @JavascriptInterface
        fun closePrintPreview() {
            activity.runOnUiThread {
                if (activity.webView.canGoBack()) {
                    activity.webView.goBack()
                } else {
                    activity.webView.loadUrl(PRODUCTION_URL + "riwayat")
                }
            }
        }

        @JavascriptInterface
        fun printDocument() {
            activity.runOnUiThread {
                val printManager = activity.getSystemService(Context.PRINT_SERVICE) as? PrintManager
                val printAdapter = activity.webView.createPrintDocumentAdapter("Tanabrew_Invoice")
                printManager?.print("Tanabrew_Invoice", printAdapter, PrintAttributes.Builder().build())
            }
        }

        @JavascriptInterface
        fun isNotificationSupported(): Boolean = true

        @JavascriptInterface
        fun getNotificationPermission(): String {
            return if (NotificationManagerCompat.from(activity).areNotificationsEnabled()) {
                "granted"
            } else {
                "default"
            }
        }

        @JavascriptInterface
        fun requestNotificationPermission() {
            activity.runOnUiThread {
                activity.checkAndRequestInitialPermissions()
            }
        }

        @JavascriptInterface
        fun showNotification(title: String, body: String) {
            activity.runOnUiThread {
                try {
                    val builder = NotificationCompat.Builder(activity, NOTIFICATION_CHANNEL_ID)
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setAutoCancel(true)

                    val notificationManager = NotificationManagerCompat.from(activity)
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                        ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
                    ) {
                        notificationManager.notify(System.currentTimeMillis().toInt(), builder.build())
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        // WhatsApp Direct Share: Mengirimkan Dokumen PDF ke WhatsApp asli
        @JavascriptInterface
        fun sharePdfToWhatsApp(base64Pdf: String, fileName: String, captionText: String, phoneNumber: String?) {
            activity.runOnUiThread {
                try {
                    val cleanBase64 = base64Pdf.substringAfter("base64,")
                    val decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                    val safeFileName = if (fileName.endsWith(".pdf")) fileName else "$fileName.pdf"
                    val pdfFile = File(activity.cacheDir, safeFileName)
                    FileOutputStream(pdfFile).use { it.write(decodedBytes) }

                    val uri = FileProvider.getUriForFile(
                        activity,
                        "${activity.packageName}.fileprovider",
                        pdfFile
                    )

                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "application/pdf"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        putExtra(Intent.EXTRA_TEXT, captionText)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }

                    // Deteksi paket WhatsApp atau WhatsApp Business
                    val pm = activity.packageManager
                    val waPackage = when {
                        isPackageInstalled("com.whatsapp", pm) -> "com.whatsapp"
                        isPackageInstalled("com.whatsapp.w4b", pm) -> "com.whatsapp.w4b"
                        else -> null
                    }

                    if (waPackage != null) {
                        sendIntent.setPackage(waPackage)
                        activity.startActivity(sendIntent)
                    } else {
                        activity.startActivity(Intent.createChooser(sendIntent, "Kirim Faktur Tanabrew"))
                    }
                } catch (e: Exception) {
                    Toast.makeText(activity, "Gagal membagikan ke WhatsApp: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }

        @JavascriptInterface
        fun onWhatsAppShareRequested(caption: String, phone: String) {
            activity.runOnUiThread {
                // Ketika tombol bagikan PDF ditekan di web, buat PDF dari tampilan atau arahkan ke WhatsApp
                // Jika invoice aktif ada di web, wrapper siap melayani
                val cleanPhone = phone.replace("[^0-9]".toRegex(), "")
                val targetPhone = if (cleanPhone.startsWith("0")) "62" + cleanPhone.substring(1) else cleanPhone
                val waUrl = if (targetPhone.isNotEmpty()) {
                    "https://wa.me/$targetPhone?text=${Uri.encode(caption)}"
                } else {
                    "https://wa.me/?text=${Uri.encode(caption)}"
                }
                activity.handleExternalIntent(waUrl)
            }
        }

        private fun isPackageInstalled(packageName: String, packageManager: PackageManager): Boolean {
            return try {
                packageManager.getPackageInfo(packageName, 0)
                true
            } catch (e: PackageManager.NameNotFoundException) {
                false
            }
        }
    }
}
