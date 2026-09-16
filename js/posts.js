/**
 * 文章数据 - Android 系统稳定性 & Framework 技术博客
 * 按时间倒序排列
 */
const postsData = [
// <<<POSTS-BEGIN>>>
    {
        id: "anr-watchdog-deep-dive",
        title: "深入解析 ANR Watchdog：从原理到线上防控体系",
        date: "2026-05-28",
        tags: ["ANR", "稳定性", "Watchdog", "系统服务"],
        excerpt: "ANR 是 Android 稳定性治理中最棘手的问题之一。本文深入剖析 ANR Watchdog 的检测原理，分析 Input/Service/Broadcast/ContentProvider 四类 ANR 的触发机制，并分享一套完整的线上 ANR 监控、归因与防控体系。",
        readTime: "18 min",
        content: `
<h2>一、ANR 的本质</h2>
<p>ANR（Application Not Responding）并非简单的"主线程阻塞"，而是 Android 系统的一种<strong>自我保护机制</strong>。当系统检测到某个应用在规定时间内未响应关键操作时，会触发 ANR 并弹出对话框（或静默杀死进程）。</p>

<blockquote>
理解 ANR 的本质，是治理 ANR 的第一步。它不是 bug，而是一种契约 —— 系统与应用的性能契约。
</blockquote>

<h2>二、四类 ANR 触发机制</h2>

<h3>2.1 Input ANR</h3>
<p>Input ANR 是最常见的类型，触发条件为：</p>
<ul>
<li>按键/触摸事件分发后 <strong>5s</strong> 内未处理完成</li>
<li>Service 执行期间前台服务 <strong>20s</strong> / 后台服务 <strong>200s</strong> 未完成</li>
</ul>

<pre><code class="language-java">// frameworks/base/services/core/java/com/android/server/input/InputManagerService.java
// ANR 判定核心逻辑
long timeout = InputConstants.DEFAULT_DISPATCHING_TIMEOUT_MILLIS; // 5000ms
if (!appWindowToken.inputDispatchingTimedOut(reason, pid, 
        didStartProcess, blamingSystem, timeoutRecord)) {
    // 触发 ANR
}</code></pre>

<h3>2.2 Service ANR</h3>
<p>Service ANR 的 timeout 值定义在 <code>ActiveServices.java</code> 中：</p>

<table>
<tr><th>服务类型</th><th>Timeout</th><th>触发条件</th></tr>
<tr><td>前台 Service</td><td>20s</td><td>onCreate/onStartCommand/onBind 未返回</td></tr>
<tr><td>后台 Service</td><td>200s</td><td>同上</td></tr>
<tr><td>前台 Service (startForeground)</td><td>10s</td><td>startForeground() 未及时调用</td></tr>
</table>

<h3>2.3 Broadcast ANR</h3>
<pre><code class="language-java">// 有序广播超时：前台 10s，后台 60s
static final int BROADCAST_FG_TIMEOUT = 10 * 1000;
static final int BROADCAST_BG_TIMEOUT = 60 * 1000;</code></pre>

<h3>2.4 ContentProvider ANR</h3>
<p>ContentProvider 的发布超时为 <strong>10s</strong>，在 <code>AMS.publishContentProviders()</code> 中检测。</p>

<h2>三、Watchdog 检测原理</h2>
<p>System Server 中的 <code>Watchdog</code> 类是一个独立线程，定期（默认 30s）向主线程的 Handler 发送监测消息。如果 60s 内未收到响应，则判定 system_server 发生 Watchdog：</p>

<pre><code class="language-java">// frameworks/base/services/core/java/com/android/server/Watchdog.java
final class HandlerChecker implements Runnable {
    public void run() {
        synchronized (mLock) {
            mCompleted = true;
            mCurrentMonitor = null;
            mLock.notifyAll();
        }
    }
    
    public boolean isOverdue() {
        return !mCompleted && (SystemClock.uptimeMillis() > mStartTime + mWaitMax);
    }
}</code></pre>

<h2>四、线上 ANR 防控体系</h2>

<h3>4.1 监控层：SIGQUIT 信号捕获</h3>
<p>利用 <code>Signal.handle()</code> 捕获 SIGQUIT 信号，在 ANR 触发时第一时间 dump 主线程堆栈：</p>

<pre><code class="language-java">Signal.handle(new Signal("QUIT"), new SignalHandler() {
    @Override
    public void handle(Signal sig) {
        // 1. 获取主线程堆栈
        // 2. 记录关键指标（CPU、内存、IO）
        // 3. 上报到监控平台
    }
});</code></pre>

<h3>4.2 归因层：堆栈聚类与根因分析</h3>
<ul>
<li><strong>堆栈指纹</strong>：对堆栈进行标准化处理，生成唯一指纹用于聚类</li>
<li><strong>归因规则</strong>：结合 Binder 调用链、锁等待链进行深度归因</li>
<li><strong>影响面评估</strong>：根据用户量、崩溃率、业务场景评估优先级</li>
</ul>

<h3>4.3 防控层：分级治理策略</h3>

<table>
<tr><th>等级</th><th>标准</th><th>响应</th></tr>
<tr><td>P0</td><td>ANR 率 > 0.5% 或 Top3 问题</td><td>24h 内必须修复或降级</td></tr>
<tr><td>P1</td><td>ANR 率 0.1% ~ 0.5%</td><td>本周内修复</td></tr>
<tr><td>P2</td><td>ANR 率 < 0.1%</td><td>排期优化</td></tr>
</table>

<h2>五、实战案例：Handler 同步屏障泄漏</h2>
<p>某次线上 ANR 堆栈显示主线程卡在 <code>Looper.loop()</code>，但无明确业务代码。深入分析发现是 <strong>SyncBarrier 泄漏</strong> 导致消息队列被无限阻塞。</p>

<pre><code class="language-java">// 根因：自定义 View 的 draw() 中调用了 requestLayout()
// 导致 ViewRootImpl 不断 post SyncBarrier，但未及时移除

// 修复：在合适时机移除 SyncBarrier，或避免在 draw() 中触发 requestLayout()
@Override
public void draw(Canvas canvas) {
    // ❌ 错误：会导致死循环
    // requestLayout();
    
    // ✅ 正确：使用标记位延迟处理
    if (mNeedsLayout) {
        mNeedsLayout = false;
        post(() -> requestLayout());
    }
}</code></pre>

<h2>六、总结</h2>
<p>ANR 治理是一项系统工程，需要从监控、归因、防控三个层面建立完整的闭环。核心要点：</p>
<ol>
<li>理解 ANR 触发机制，区分不同类型</li>
<li>建立线上 SIGQUIT 捕获能力，第一时间获取现场</li>
<li>堆栈聚类 + 深度归因，定位根因而非表象</li>
<li>分级治理，优先解决影响面最大的问题</li>
</ol>
        `
    },
    {
        id: "binder-death-recipient-memory-leak",
        title: "Binder DeathRecipient 内存泄漏：从源码到根治方案",
        date: "2026-05-15",
        tags: ["Binder", "内存优化", "Framework", "稳定性"],
        excerpt: "Binder 的 DeathRecipient 机制是系统服务间通信的生命线，但也是内存泄漏的重灾区。本文通过源码分析揭示泄漏根因，并提供一套基于弱引用 + 生命周期绑定的根治方案。",
        readTime: "15 min",
        content: `
<h2>一、DeathRecipient 机制回顾</h2>
<p>DeathRecipient 是 Binder 提供的进程死亡监听机制。当服务端进程死亡时，Binder 驱动会通知客户端，触发 <code>IBinder.DeathRecipient.binderDied()</code> 回调。</p>

<pre><code class="language-java">// 典型使用方式
IBinder binder = ServiceManager.getService("service_name");
IBinder.DeathRecipient recipient = new IBinder.DeathRecipient() {
    @Override
    public void binderDied() {
        // 重新绑定服务
    }
};
binder.linkToDeath(recipient, 0);</code></pre>

<h2>二、泄漏根因分析</h2>

<h3>2.1 Native 层引用链</h3>
<p><code>linkToDeath()</code> 最终调用到 Native 层的 <code>IPCThreadState</code>，会将 DeathRecipient 的引用存入 <code>mObits</code> 列表：</p>

<pre><code class="language-cpp">// frameworks/native/libs/binder/IPCThreadState.cpp
status_t IPCThreadState::requestDeathNotification(
        const sp<IBinder>& binder, const sp<DeathRecipient>& recipient) {
    // recipient 被 sp<> 强引用，直到 unlinkToDeath() 被调用
    mObits.push(recipient);
    return NO_ERROR;
}</code></pre>

<h3>2.2 Java 层常见问题</h3>
<ul>
<li><strong>匿名内部类持有外部类引用</strong>：DeathRecipient 匿名类隐式持有 Activity/Service 引用</li>
<li><strong>unlinkToDeath 遗漏</strong>：异常路径、生命周期错位导致未解注册</li>
<li><strong>跨进程对象生命周期不一致</strong>：服务端已死，客户端仍持有引用</li>
</ul>

<h2>三、泄漏现场复现</h2>

<pre><code class="language-java">public class LeakActivity extends Activity {
    private IBinder mRemoteBinder;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mRemoteBinder = getSystemServiceBinder();
        
        // ❌ 泄漏：匿名 DeathRecipient 持有 Activity 引用
        // 且未在 onDestroy 中 unlinkToDeath
        mRemoteBinder.linkToDeath(new IBinder.DeathRecipient() {
            @Override
            public void binderDied() {
                // 这里隐式持有 LeakActivity.this
                Log.d(TAG, "Service died, retry...");
            }
        }, 0);
    }
}</code></pre>

<h2>四、根治方案：弱引用 + 生命周期绑定</h2>

<h3>4.1 安全封装类</h3>
<pre><code class="language-java">public class SafeDeathRecipient implements IBinder.DeathRecipient {
    private final WeakReference<DeathCallback> mCallbackRef;
    private final AtomicBoolean mLinked = new AtomicBoolean(false);
    private IBinder mBinder;
    
    public interface DeathCallback {
        void onBinderDied();
    }
    
    public static SafeDeathRecipient link(IBinder binder, DeathCallback callback) {
        SafeDeathRecipient recipient = new SafeDeathRecipient(callback);
        try {
            binder.linkToDeath(recipient, 0);
            recipient.mLinked.set(true);
            recipient.mBinder = binder;
        } catch (RemoteException e) {
            callback.onBinderDied();
        }
        return recipient;
    }
    
    @Override
    public void binderDied() {
        DeathCallback callback = mCallbackRef.get();
        if (callback != null) {
            callback.onBinderDied();
        }
        unlink(); // 自动清理
    }
    
    public void unlink() {
        if (mLinked.compareAndSet(true, false) && mBinder != null) {
            mBinder.unlinkToDeath(this, 0);
            mBinder = null;
        }
    }
}</code></pre>

<h3>4.2 Lifecycle 自动绑定</h3>
<pre><code class="language-java">public class BinderLifecycleObserver implements LifecycleEventObserver {
    private final List<SafeDeathRecipient> mRecipients = new ArrayList<>();
    
    public void add(SafeDeathRecipient recipient) {
        mRecipients.add(recipient);
    }
    
    @Override
    public void onStateChanged(LifecycleOwner source, Lifecycle.Event event) {
        if (event == Lifecycle.Event.ON_DESTROY) {
            for (SafeDeathRecipient r : mRecipients) {
                r.unlink();
            }
            mRecipients.clear();
        }
    }
}</code></pre>

<h2>五、线上检测方案</h2>

<h3>5.1 Binder 引用计数监控</h3>
<p>通过反射获取 <code>BinderProxy</code> 的 <code>mOrgue</code> 列表大小，监控 DeathRecipient 注册数量：</p>

<pre><code class="language-java">public static int getDeathRecipientCount(IBinder binder) {
    try {
        Field mOrgue = BinderProxy.class.getDeclaredField("mOrgue");
        mOrgue.setAccessible(true);
        Object orgue = mOrgue.get(binder);
        if (orgue instanceof ArrayList) {
            return ((ArrayList<?>) orgue).size();
        }
    } catch (Exception e) {
        Log.w(TAG, "getDeathRecipientCount failed", e);
    }
    return -1;
}</code></pre>

<h3>5.2 LeakCanary 扩展</h3>
<p>自定义 LeakCanary 的 <code>HeapDumper</code>，增加对 BinderProxy 的检测规则：</p>

<pre><code class="language-java">// 在 heap dump 中搜索 BinderProxy -> DeathRecipient 引用链
if (obj.className.contains("BinderProxy")) {
    long orgueRef = readField(obj, "mOrgue");
    if (orgueRef != 0) {
        // 分析 orgue 列表中的回调对象
        analyzeDeathRecipients(orgueRef);
    }
}</code></pre>

<h2>六、总结</h2>
<table>
<tr><th>问题</th><th>根因</th><th>解决方案</th></tr>
<tr><td>Activity/Service 泄漏</td><td>匿名类持有外部引用</td><td>使用静态内部类 + WeakReference</td></tr>
<tr><td>unlinkToDeath 遗漏</td><td>异常路径未处理</td><td>Lifecycle 自动解注册</td></tr>
<tr><td>重复注册</td><td>业务逻辑缺陷</td><td>注册前检查 + 幂等设计</td></tr>
</table>
        `
    },
    {
        id: "perfetto-systrace-analysis",
        title: "Perfetto 深度实战：从 Trace 采集到卡顿根因定位",
        date: "2026-04-30",
        tags: ["性能优化", "Perfetto", "Systrace", "卡顿治理"],
        excerpt: "Perfetto 已经全面取代 Systrace 成为 Android 性能分析的标准工具。本文从底层 Ring Buffer 机制讲起，到 UI 线程 / RenderThread / SurfaceFlinger 的全链路 trace 分析方法。",
        readTime: "22 min",
        content: `
<h2>一、Perfetto 架构概览</h2>
<p>Perfetto 采用用户态 + 内核态双层架构：</p>
<ul>
<li><strong>Traced</strong>：用户态守护进程，管理数据源和会话</li>
<li><strong>Probes</strong>：各类探针（ftrace、atrace、heapprofd 等）</li>
<li><strong>Ring Buffer</strong>：核心数据通道，采用无锁 MPSC 队列</li>
</ul>

<pre><code class="language-cpp">// perfetto/traced/probes/ftrace/ftrace_procfs.cc
// ftrace 数据读取核心逻辑
bool FtraceProcfs::ReadIntoStringUntilEOF(std::string* out) {
    char buffer[4096];
    while (true) {
        ssize_t r = read(raw_pipe_fd_, buffer, sizeof(buffer));
        if (r <= 0) break;
        out->append(buffer, static_cast<size_t>(r));
    }
    return !out->empty();
}</code></pre>

<h2>二、Trace 采集最佳实践</h2>

<h3>2.1 命令行采集</h3>
<pre><code class="language-bash"># 完整系统 trace（包含 sched、am、wm、gfx、input）
adb shell perfetto \
  -c - --txt \
  -o /data/misc/perfetto-traces/trace \
<<EOF
buffers: { size_kb: 65536 }
data_sources: {
  config {
    name: "linux.ftrace"
    ftrace_config {
      ftrace_events: "sched/sched_switch"
      ftrace_events: "sched/sched_wakeup"
      ftrace_events: "sched/sched_blocked_reason"
      ftrace_events: "am"
      ftrace_events: "wm"
      ftrace_events: "gfx"
      ftrace_events: "input"
      buffer_size_kb: 8192
      drain_period_ms: 250
    }
  }
}
duration_ms: 10000
EOF

adb pull /data/misc/perfetto-traces/trace ./trace.perfetto-trace</code></pre>

<h3>2.2 代码中动态标记</h3>
<pre><code class="language-java">// Android 12+ 推荐使用 Trace API
Trace.beginSection("CustomEvent::onClick");
try {
    doHeavyWork();
} finally {
    Trace.endSection();
}

// 异步 trace（支持 coroutine / RxJava）
Trace.beginAsyncSection("NetworkRequest", requestId);
// ... 请求完成后
Trace.endAsyncSection("NetworkRequest", requestId);</code></pre>

<h2>三、卡顿分析方法论</h2>

<h3>3.1 UI 线程分析框架</h3>
<p>卡顿 = 掉帧 = <strong>VSync 周期内未提交 Buffer</strong>。在 Perfetto 中关注三个关键线程：</p>

<table>
<tr><th>线程</th><th>职责</th><th>关键 Trace 点</th></tr>
<tr><td>App UI Thread</td><td>处理用户输入、执行 measure/layout/draw</td><td>Choreographer#doFrame, deliverInputEvent</td></tr>
<tr><td>RenderThread</td><td>执行 OpenGL/Vulkan 渲染命令</td><td>DrawFrame, flush commands</td></tr>
<tr><td>SurfaceFlinger</td><td>合成图层并送显</td><td>onMessageReceived, latchBuffer</td></tr>
</table>

<h3>3.2 典型卡顿模式识别</h3>

<h4>模式一：主线程耗时操作</h4>
<pre><code class="language-java">// Perfetto 中观察到的特征：
// UI Thread 的 doFrame 持续时间 > 16ms
// RenderThread 空闲等待
// SurfaceFlinger 正常合成

// 根因：onDraw() / onLayout() 中执行了耗时逻辑
// 解决：异步化、分帧加载、使用 RecyclerView 预加载</code></pre>

<h4>模式二：RenderThread 阻塞</h4>
<pre><code class="language-java">// 特征：
// UI Thread doFrame 正常
// RenderThread DrawFrame 耗时很长
// GPU 队列堆积

// 根因：Shader 编译、大量 Overdraw、复杂 Path
// 解决：Shader 预编译、减少 Overdraw、使用 Hardware Layer</code></pre>

<h4>模式三：Buffer 堆积</h4>
<pre><code class="language-java">// 特征：
// dequeueBuffer 等待时间长
// SurfaceFlinger 掉帧
// GPU 完成渲染但无法提交

// 根因：Triple Buffer 被占满，通常伴随内存压力
// 解决：减少 Surface 数量、优化 Bitmap 内存、回收不可见页面资源</code></pre>

<h2>四、高级分析技巧</h2>

<h3>4.1 Binder 调用链追踪</h3>
<p>开启 <code>binder_lock</code> 和 <code>binder_transaction</code> trace，分析跨进程调用耗时：</p>

<pre><code class="language-bash"># 在 perfetto config 中添加
ftrace_events: "binder/binder_lock"
ftrace_events: "binder/binder_transaction"
ftrace_events: "binder/binder_transaction_received"</code></pre>

<h3>4.2 内存压力与卡顿关联</h3>
<p>结合 <code>mm_event</code> 和 <code>ion_buffer</code> trace，分析内存回收导致的卡顿：</p>

<pre><code class="language-java">// 关注以下事件：
// - kswapd 活动频率
// - direct reclaim 耗时
// - ion_buffer 分配/释放延迟

// 若 kswapd 频繁触发且 direct reclaim 时间长：
// 说明系统内存紧张，应用应主动降低内存占用</code></pre>

<h3>4.3 CPU 调度分析</h3>
<pre><code class="language-java">// 使用 sched/sched_switch 和 sched/sched_wakeup 分析：
// 1. UI Thread 是否被大核调度
// 2. 是否存在优先级反转
// 3. CPU 频率是否因 thermal 被限制

// 典型问题：
// UI Thread 被调度到小核，或频繁迁移导致 cache miss</code></pre>

<h2>五、自动化卡顿检测</h2>

<pre><code class="language-java">public class FrameMetricsAnalyzer {
    private final Window.OnFrameMetricsAvailableListener mListener = 
        new Window.OnFrameMetricsAvailableListener() {
            @Override
            public void onFrameMetricsAvailable(Window window, 
                    FrameMetrics frameMetrics, int dropCountSinceLastInvocation) {
                long intendedVsync = frameMetrics.getMetric(DRAW_DURATION);
                long vsync = frameMetrics.getMetric(VSYNC_TIMESTAMP);
                long delay = vsync - intendedVsync;
                
                if (delay > 16_000_000) { // > 16ms
                    // 记录掉帧，关联当前场景
                    reportJank(delay / 1_000_000, getCurrentScene());
                }
            }
        };
}</code></pre>

<h2>六、总结</h2>
<p>Perfetto 是 Android 性能分析的利器，但要发挥它的价值，需要建立系统化的分析方法论：</p>
<ol>
<li>掌握 Trace 采集配置，根据问题场景选择数据源</li>
<li>理解 UI/Render/SurfaceFlinger 三线程协作模型</li>
<li>识别典型卡顿模式，建立快速定位能力</li>
<li>结合 Binder、内存、CPU 调度 trace 进行深度分析</li>
</ol>
        `
    },
    {
        id: "aosp-build-system-guide",
        title: "AOSP 编译系统深度解析：Soong、Blueprint 与 Ninja",
        date: "2026-04-12",
        tags: ["AOSP", "编译系统", "Soong", "Android构建"],
        excerpt: "从 Android.mk 到 Android.bp，从 Make 到 Soong 再到 Ninja，AOSP 的编译系统经历了巨大变革。本文深入分析三者的关系、转换流程与定制方法。",
        readTime: "16 min",
        content: `
<h2>一、编译系统演进路线</h2>

<table>
<tr><th>时期</th><th>构建工具</th><th>配置文件</th><th>特点</th></tr>
<tr><td>Android 7 之前</td><td>GNU Make</td><td>Android.mk</td><td>解析慢、难以并行</td></tr>
<tr><td>Android 7~9</td><td>Kati + Ninja</td><td>Android.mk → .ninja</td><td>Kati 将 Makefile 转为 Ninja</td></tr>
<tr><td>Android 10+</td><td>Soong + Ninja</td><td>Android.bp</td><td>原生支持 Blueprint，解析速度大幅提升</td></tr>
</table>

<h2>二、Soong 架构解析</h2>

<h3>2.1 核心组件</h3>
<pre><code class="language-cpp">// build/soong/cmd/soong_build/main.go
// Soong 入口：解析 Android.bp 生成 Ninja 文件
func main() {
    ctx := android.NewContext()
    ctx.RegisterModuleType("cc_library", cc.LibraryFactory)
    ctx.RegisterModuleType("java_library", java.LibraryFactory)
    ctx.RegisterModuleType("android_app", java.AndroidAppFactory)
    // ...
    ctx.ParseBlueprintsFiles("Android.bp")
    ctx.WriteNinjaFile("build.ninja")
}</code></pre>

<h3>2.2 Blueprint 语法</h3>
<pre><code class="language-bash"># Android.bp 示例
cc_library {
    name: "libutils",
    srcs: [
        "Errors.cpp",
        "FileMap.cpp",
        "JenkinsHash.cpp",
        "LightRefBase.cpp",
        "NativeHandle.cpp",
        "Printer.cpp",
        "RefBase.cpp",
        "SharedBuffer.cpp",
        "StopWatch.cpp",
        "String8.cpp",
        "String16.cpp",
        "StrongPointer.cpp",
        "SystemClock.cpp",
        "Threads.cpp",
        "Timers.cpp",
        "Tokenizer.cpp",
        "Unicode.cpp",
        "VectorImpl.cpp",
    ],
    shared_libs: [
        "liblog",
        "libcutils",
        "libprocessgroup",
    ],
    export_include_dirs: ["include"],
}</code></pre>

<h2>三、定制编译流程</h2>

<h3>3.1 添加自定义模块</h3>
<pre><code class="language-bash">// device/my_company/my_product/my_module/Android.bp
cc_binary {
    name: "my_system_service",
    srcs: [
        "main.cpp",
        "MyService.cpp",
    ],
    shared_libs: [
        "libbinder",
        "libutils",
        "libcutils",
    ],
    init_rc: ["my_system_service.rc"],
    vendor: true,
}</code></pre>

<h3>3.2 自定义 Soong 插件</h3>
<pre><code class="language-go">// build/soong/my_plugin/my_plugin.go
package my_plugin

import (
    "android/soong/android"
    "android/soong/cc"
)

func init() {
    android.RegisterModuleType("my_custom_library", customLibraryFactory)
}

func customLibraryFactory() android.Module {
    module := cc.NewLibrary()
    module.AddProperties(&customProperties{})
    return module
}

type customProperties struct {
    Enable_obfuscation *bool
}

func (p *customProperties) GenerateAndroidBuildActions(ctx android.ModuleContext) {
    // 自定义构建逻辑
}</code></pre>

<h2>四、编译加速技巧</h2>

<h3>4.1 ccache + RBE</h3>
<pre><code class="language-bash"># 启用 ccache
export USE_CCACHE=1
export CCACHE_EXEC=/usr/bin/ccache
ccache -M 50G

# 启用 Remote Build Execution (Google 内部)
export RBE_service="remotebuildexecution.googleapis.com:443"
export RBE_project="my-project"

# 编译
m -j$(nproc)</code></pre>

<h3>4.2 增量编译优化</h3>
<pre><code class="language-bash"># 只编译指定模块
m my_system_service

# 查看模块依赖关系
m --showcommands my_system_service

# 清理并重新编译
m clean-my_system_service
m my_system_service</code></pre>

<h2>五、常见问题排查</h2>

<table>
<tr><th>问题</th><th>排查方法</th><th>解决</th></tr>
<tr><td>Android.bp 解析失败</td><td>out/soong.log</td><td>检查语法、引用的模块是否存在</td></tr>
<tr><td>头文件找不到</td><td>export_include_dirs / header_libs</td><td>确认依赖关系正确</td></tr>
<tr><td>链接错误</td><td>readelf -d 检查 so 依赖</td><td>补充 shared_libs / static_libs</td></tr>
<tr><td>编译缓存不生效</td><td>ccache -s 查看命中率</td><td>检查 CCACHE_EXEC 路径</td></tr>
</table>
        `
    },
    {
        id: "wms-window-visibility-optimization",
        title: "WMS 窗口可见性优化：从 addView 到 Surface 释放的全链路",
        date: "2026-03-20",
        tags: ["WMS", "性能优化", "Framework", "内存优化"],
        excerpt: "WindowManagerService 管理着系统中所有窗口的生命周期。窗口的创建、显示、隐藏、销毁涉及复杂的跨进程协调，也是内存和性能问题的重灾区。",
        readTime: "20 min",
        content: `
<h2>一、Window 添加流程</h2>
<pre><code class="language-java">// ViewManagerImpl.addView() 调用链
ViewManagerImpl.addView()
  → WindowManagerImpl.addView()
    → WindowManagerGlobal.addView()
      → ViewRootImpl.setView()
        → Session.addToDisplayAsUser() // Binder 调用 WMS
          → WindowManagerService.addWindow()</code></pre>

<h2>二、WMS 中的窗口状态机</h2>

<pre><code class="language-java">// WindowState.java 中的关键状态
class WindowState extends WindowContainer<WindowState> {
    // 可见性状态
    boolean mHasSurface;      // 是否有有效 Surface
    boolean mPolicyVisibility; // 策略层可见性
    boolean mAttachedHidden;   // 父窗口是否隐藏
    boolean mPermanentlyHidden; // 是否永久隐藏
    
    // 计算最终可见性
    boolean isVisible() {
        return mHasSurface && mPolicyVisibility 
            && !mAttachedHidden && !mPermanentlyHidden
            && !mHiddenWhileSuspended;
    }
}</code></pre>

<h2>三、内存泄漏重灾区</h2>

<h3>3.1 Dialog/PopupWindow 泄漏</h3>
<pre><code class="language-java">// ❌ 错误：未 dismiss 的 Dialog 持有 DecorView -> Activity 引用
Dialog dialog = new Dialog(context);
dialog.show();
// ... Activity 销毁后 dialog 未 dismiss

// ✅ 正确：Lifecycle 绑定自动 dismiss
public class AutoDismissDialog extends Dialog 
        implements LifecycleEventObserver {
    
    public AutoDismissDialog(Context context, Lifecycle lifecycle) {
        super(context);
        lifecycle.addObserver(this);
    }
    
    @Override
    public void onStateChanged(LifecycleOwner source, Event event) {
        if (event == Event.ON_DESTROY && isShowing()) {
            dismiss();
        }
    }
}</code></pre>

<h3>3.2 Surface 未释放</h3>
<pre><code class="language-java">// ViewRootImpl 中 Surface 释放时机
void dispatchDetachedFromWindow() {
    // 1. 释放 HardwareRenderer
    mHardwareRenderer.destroy();
    
    // 2. 释放 SurfaceControl
    mSurfaceControl.release();
    
    // 3. 通知 WMS 移除窗口
    mWindowSession.remove(mWindow);
    
    // 4. 清空消息队列
    mHandler.removeCallbacksAndMessages(null);
}</code></pre>

<h2>四、窗口可见性优化策略</h2>

<h3>4.1 延迟加载策略</h3>
<pre><code class="language-java">public class LazyWindowHelper {
    private View mDecorView;
    private boolean mIsAttached;
    
    public void attachWhenNeeded(ViewGroup parent) {
        if (mDecorView == null) {
            mDecorView = createDecorView();
        }
        if (!mIsAttached) {
            parent.addView(mDecorView);
            mIsAttached = true;
        }
    }
    
    public void detachIfIdle(long idleThresholdMs) {
        if (mIsAttached && isIdle(idleThresholdMs)) {
            ((ViewGroup) mDecorView.getParent()).removeView(mDecorView);
            mIsAttached = false;
        }
    }
}</code></pre>

<h3>4.2 SurfaceView vs TextureView 选择</h3>
<table>
<tr><th>维度</th><th>SurfaceView</th><th>TextureView</th></tr>
<tr><td>渲染方式</td><td>独立 Surface，双缓冲</td><td>共享 Surface，GPU 合成</td></tr>
<tr><td>内存占用</td><td>低（不参与主 Surface 合成）</td><td>高（需要额外 GPU 内存）</td></tr>
<tr><td>动画支持</td><td>差（独立窗口层级）</td><td>好（普通 View 属性动画）</td></tr>
<tr><td>适用场景</td><td>视频播放、相机预览</td><td>需要动画变换的渲染</td></tr>
</table>

<h2>五、WMS 性能监控</h2>

<pre><code class="language-java">// 监控窗口数量与层级深度
public class WindowMetricsCollector {
    public void dumpWindowInfo() {
        try {
            IWindowManager wm = WindowManager.getService();
            Parcel reply = Parcel.obtain();
            wm.dumpWindowStateToProto(reply);
            
            // 解析 proto 数据
            WindowLayoutProto layout = WindowLayoutProto.parseFrom(
                reply.createByteArray());
            
            int windowCount = layout.getWindowsCount();
            int maxLayer = layout.getRootWindowContainer()
                .getDisplay(0).getLayer();
            
            // 上报指标
            reportWindowMetrics(windowCount, maxLayer);
            
        } catch (Exception e) {
            Log.e(TAG, "dumpWindowInfo failed", e);
        }
    }
}</code></pre>
        `
    },
    {
        id: "input-system-dispatcher-analysis",
        title: "Input 系统分发机制：从 kernel 到 App 的全链路追踪",
        date: "2026-03-05",
        tags: ["Input", "Framework", "ANR", "稳定性"],
        excerpt: "触摸事件从屏幕到 App 的旅程，涉及 kernel、SurfaceFlinger、InputDispatcher、WMS 的复杂协作。本文通过 ftrace 和源码，完整还原这条数据通路。",
        readTime: "19 min",
        content: `
<h2>一、Input 事件全链路</h2>

<pre><code class="language-java">// 事件流转路径
[Touch Screen] 
  → [Kernel: input_event] 
    → [SurfaceFlinger: EventHub] 
      → [InputReader: 读取原始事件]
        → [InputDispatcher: 分发到目标窗口]
          → [WMS: 确定目标 WindowState]
            → [App: InputChannel → ViewRootImpl → DecorView → ...]</code></pre>

<h2>二、InputReader 与 InputDispatcher</h2>

<h3>2.1 InputReader 线程</h3>
<pre><code class="language-cpp">// frameworks/native/services/inputflinger/reader/InputReader.cpp
void InputReader::loopOnce() {
    int32_t oldGeneration;
    int32_t timeoutMillis;
    
    // 1. 从 EventHub 读取事件
    size_t count = mEventHub->getEvents(timeoutMillis, mEventBuffer, EVENT_BUFFER_SIZE);
    
    // 2. 处理原始事件（坐标转换、按键映射）
    processEventsLocked(mEventBuffer, count);
    
    // 3. 通知 InputDispatcher
    mQueuedListener.flush();
}</code></pre>

<h3>2.2 InputDispatcher 分发策略</h3>
<pre><code class="language-cpp">// InputDispatcher::dispatchEventLocked
bool InputDispatcher::dispatchEventLocked(nsecs_t currentTime,
        EventEntry* eventEntry, const std::vector<InputTarget>& inputTargets) {
    
    for (const InputTarget& inputTarget : inputTargets) {
        sp<Connection> connection = getConnectionLocked(inputTarget.inputChannel);
        if (connection != nullptr) {
            // 通过 InputChannel 的 socket pair 发送事件
            enqueueDispatchEntriesLocked(currentTime, connection,
                eventEntry, inputTarget);
        }
    }
    return true;
}</code></pre>

<h2>三、ANR 中的 Input 超时</h2>

<p>InputDispatcher 维护一个 <code>waitQueue</code>，记录已分发但未收到 App 响应的事件：</p>

<pre><code class="language-cpp">// InputDispatcher::processAnrsLocked
nsecs_t InputDispatcher::processAnrsLocked() {
    const nsecs_t currentTime = now();
    
    // 检查 waitQueue 中是否有超时事件
    for (const sp<Connection>& connection : mConnectionsByFd) {
        if (connection->waitQueue.empty()) continue;
        
        DispatchEntry* entry = connection->waitQueue.front();
        nsecs_t timeout = getDispatchingTimeoutLocked(connection);
        
        if (currentTime > entry->deliveryTime + timeout) {
            // 触发 INPUT_ANR
            onANRLocked(connection, entry);
            return 0; // 立即处理
        }
    }
    return LONG_LONG_MAX;
}</code></pre>

<h2>四、触摸事件优化</h2>

<h3>4.1 减少事件上报频率</h3>
<pre><code class="language-java">// 在 device tree 中配置触控采样率
// arch/arm64/boot/dts/my_device.dtsi
&touchscreen {
    // 降低触控采样率以减少 CPU 中断
    report_rate = <120>; // 默认 240Hz，降为 120Hz
};

// 或者在 InputReader 中合并事件
void InputReader::processEventsLocked(const RawEvent* rawEvents, size_t count) {
    // 实现事件合并逻辑，减少上层处理次数
}</code></pre>

<h3>4.2 优化事件处理链路</h3>
<pre><code class="language-java">public class OptimizedViewGroup extends ViewGroup {
    @Override
    public boolean dispatchTouchEvent(MotionEvent ev) {
        // 1. 快速过滤：不在目标区域直接返回
        if (!isInTargetArea(ev)) {
            return false;
        }
        
        // 2. 避免在 dispatch 中创建对象
        // ❌ 错误：每次创建 Rect
        // Rect hitRect = new Rect();
        
        // ✅ 正确：使用 ThreadLocal 或成员变量
        mHitRect.set(left, top, right, bottom);
        
        return super.dispatchTouchEvent(ev);
    }
}</code></pre>

<h2>五、Input 系统调试</h2>

<pre><code class="language-bash"># 1. 查看当前 Input 窗口信息
adb shell dumpsys input

# 2. 开启 Input 详细日志
adb shell setprop log.tag.InputDispatcher VERBOSE
adb shell setprop log.tag.InputReader VERBOSE

# 3. 使用 getevent 查看原始事件
adb shell getevent -lt /dev/input/event2

# 4. 发送测试事件
adb shell input tap 500 500
adb shell input swipe 100 500 900 500 200</code></pre>
        `
    }
// <<<POSTS-END>>>
];

// 导读分类（guide.html 使用）：name 分类名，desc 简介，posts 为文章 id 列表，顺序即推荐阅读顺序
// 新文章写完后，把 id 加到合适的分类中即可；一篇文章可属于多个分类
const guideCategories = [
// <<<GUIDE-BEGIN>>>
    {
        name: "系统启动与构建",
        desc: "从 AOSP 源码编译到系统启动，建立全链路视角",
        posts: ["aosp-build-system-guide"]
    },
    {
        name: "通信机制",
        desc: "Binder、Handler 等 Android 核心通信方式",
        posts: ["binder-death-recipient-memory-leak"]
    },
    {
        name: "系统服务",
        desc: "WMS、AMS、PMS、Input 等核心服务的运行机制",
        posts: ["wms-window-visibility-optimization", "input-system-dispatcher-analysis"]
    },
    {
        name: "稳定性",
        desc: "ANR、Crash、内存泄漏的治理方法论与实战",
        posts: ["anr-watchdog-deep-dive", "binder-death-recipient-memory-leak"]
    },
    {
        name: "性能优化",
        desc: "Trace 采集分析与卡顿根因定位",
        posts: ["perfetto-systrace-analysis"]
    },
    {
        name: "四大组件",
        desc: "四大组件相关",
        posts: ["anr-watchdog-deep-dive"]
    },
    {
        name: "进程管理",
        desc: "framework层的进程管理，包括adj的计算，lmkd的查杀逻辑",
        posts: []
    }
// <<<GUIDE-END>>>
];

// 辅助函数：获取所有标签及数量
function getAllTags() {
    const tagMap = {};
    postsData.forEach(post => {
        post.tags.forEach(tag => {
            tagMap[tag] = (tagMap[tag] || 0) + 1;
        });
    });
    return Object.entries(tagMap).sort((a, b) => b[1] - a[1]);
}

// 辅助函数：根据 ID 查找文章
function getPostById(id) {
    return postsData.find(p => p.id === id);
}

// 辅助函数：根据标签过滤文章
function getPostsByTag(tag) {
    return postsData.filter(p => p.tags.includes(tag));
}

// 辅助函数：搜索文章
function searchPosts(query) {
    const lower = query.toLowerCase();
    return postsData.filter(p => 
        p.title.toLowerCase().includes(lower) ||
        p.excerpt.toLowerCase().includes(lower) ||
        p.tags.some(t => t.toLowerCase().includes(lower))
    );
}
