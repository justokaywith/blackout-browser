import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
System.getenv("BLACKOUT_BUILD_DIR")?.let { layout.buildDirectory.set(file(it)) }

android {
    namespace = "online.pactuno.blackout"
    compileSdk = 35

    defaultConfig {
        applicationId = "online.pactuno.blackout"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "0.3.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    val keystorePropertiesFile = rootProject.file("../keystore/keystore.properties")
    val keystoreProperties = Properties()
    if (keystorePropertiesFile.exists()) {
        FileInputStream(keystorePropertiesFile).use { keystoreProperties.load(it) }
    }

    signingConfigs {
        getByName("debug") { storeFile = rootProject.file("../.local/debug.keystore") }
        create("release") {
            val storeFilePath = keystoreProperties.getProperty("RELEASE_STORE_FILE")
            if (storeFilePath != null && file(storeFilePath).exists()) {
                storeFile = file(storeFilePath)
                storePassword = keystoreProperties.getProperty("RELEASE_STORE_PASSWORD")
                keyAlias = keystoreProperties.getProperty("RELEASE_KEY_ALIAS")
                keyPassword = keystoreProperties.getProperty("RELEASE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.findByName("release")?.takeIf { it.storeFile?.exists() == true }
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
    lint {
        textReport = false
        xmlReport = true
        htmlReport = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
}
