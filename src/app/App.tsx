import { useState, useEffect } from "react";
import AdminUpload from "@/app/components/AdminUpload";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { initializeStorageBucket } from "@/app/utils/supabaseStorage";
import { initializeDemoToken } from "@/app/utils/buildHeaders";
import {
  projectId,
  publicAnonKey,
} from "@/utils/supabase/info";

// Import contexts
import { AuthProvider } from "@/app/context/AuthContext";
import { CurrencyProvider } from "@/app/context/CurrencyContext";
import { CartProvider } from "@/app/context/CartContext";
import { WishlistProvider } from "@/app/context/WishlistContext";
import { ProductProvider } from "@/app/context/ProductContext";

// Import pages
import HomePage from "@/app/pages/HomePage";
import ContactPage from "@/app/pages/ContactPage";
import PrivacyPolicyPage from "@/app/pages/PrivacyPolicyPage";
import FAQPage from "@/app/pages/FAQPage";
import BlogPage from "@/app/pages/BlogPage";
import SignInPage from "@/app/pages/SignInPage";
import SignUpPage from "@/app/pages/SignUpPage";
import AuthCallbackPage from "@/app/pages/AuthCallbackPage";
import WishlistPage from "@/app/pages/WishlistPage";
import TestReviewPage from "@/app/pages/TestReviewPage";
import InitDemo from "@/app/pages/InitDemo";
import StorageSetup from "@/app/pages/StorageSetup";

// Admin pages
import AdminDashboard from "@/app/pages/admin/AdminDashboard";
import ItemsPage from "@/app/pages/admin/ItemsPage";
import AddEditItemPage from "@/app/pages/admin/AddEditItemPage";
import ProductFieldsConfigPage from "@/app/pages/admin/ProductFieldsConfigPage";
import CategoriesPage from "@/app/pages/admin/CategoriesPage";
import CouponsPage from "@/app/pages/admin/CouponsPage";
import OrdersPageAdmin from "@/app/pages/admin/OrdersPage";
import OrderDetailPageAdmin from "@/app/pages/admin/OrderDetailPage";
import CustomersPage from "@/app/pages/admin/CustomersPage";
import RoleManagementPage from "@/app/pages/admin/RoleManagementPage";
import CustomerEmailsPage from "@/app/pages/admin/CustomerEmailsPage";
import { CustomerQueriesPage } from "@/app/pages/admin/CustomerQueriesPage";
import SalesPage from "@/app/pages/admin/SalesPage";
import NotificationsPage from "@/app/pages/admin/NotificationsPage";
import ReportsPage from "@/app/pages/admin/ReportsPage";
import OrderManagementDemoPage from "@/app/pages/admin/OrderManagementDemoPage";
import WorkSamplesPage from "@/app/pages/admin/WorkSamplesPage";
import InitializeWorkSamplesPage from "@/app/pages/admin/InitializeWorkSamplesPage";
import DebugOrdersPage from "@/app/pages/admin/DebugOrdersPage";
import { OrdersDiagnosticsPage } from "@/app/pages/admin/OrdersDiagnosticsPage";
import { APIKeysPage } from "@/app/pages/admin/APIKeysPage";
import { PaymentSettingsPage } from "@/app/pages/admin/PaymentSettingsPage";
import { ItemReviewsPage } from "@/app/pages/admin/ItemReviewsPage";
import { DataCleanupPage } from "@/app/pages/admin/DataCleanupPage";
import OrdersSetupPage from "@/app/pages/admin/OrdersSetupPage";
import { OrdersSetupChecklistPage } from "@/app/pages/admin/OrdersSetupChecklistPage";
import QuickOrdersFixPage from "@/app/pages/admin/QuickOrdersFixPage";
import { DiagnosticPage } from "@/app/pages/admin/DiagnosticPage";
import { DeploymentGuidePage } from "@/app/pages/admin/DeploymentGuidePage";

// Pages used in routes
import CheckoutDemo from "@/app/pages/CheckoutDemo";
import ProductPage from "@/app/pages/ProductPage";
import TrackOrderPage from "@/app/pages/TrackOrderPage";
import LiveOrderTrackingPage from "@/app/pages/LiveOrderTrackingPage";
import AllApostilleProductsPage from "@/app/pages/AllApostilleProductsPage";
import ApostillePage from "@/app/pages/ApostillePage";
import AllAttestationProductsPage from "@/app/pages/AllAttestationProductsPage";
import AllStartupProductsPage from "@/app/pages/AllStartupProductsPage";
import AllLanguageProductsPage from "@/app/pages/AllLanguageProductsPage";
import MyOrdersPage from "@/app/pages/MyOrdersPage";
import MyProfilePage from "@/app/pages/MyProfilePage";
import MyAddressPage from "@/app/pages/MyAddressPage";
import MyDashboardPage from "@/app/pages/MyDashboardPage";
import NewCartPage from "@/app/pages/NewCartPage";
import NewCheckoutAddressPage from "@/app/pages/NewCheckoutAddressPage";
import NewCheckoutReviewPage from "@/app/pages/NewCheckoutReviewPage";
import NewPaymentPage from "@/app/pages/NewPaymentPage";
import BankGatewayPage from "@/app/pages/BankGatewayPage";
import WalletGatewayPage from "@/app/pages/WalletGatewayPage";
import OrderSuccessPage from "@/app/pages/OrderSuccessPage";
import PaymentSummaryPage from "@/app/pages/PaymentSummaryPage";
import AllTranslationProductsPage from "@/app/pages/AllTranslationProductsPage";
import TermsAndConditionsPage from "@/app/pages/TermsAndConditionsPage";
import RefundCancellationPolicyPage from "@/app/pages/RefundCancellationPolicyPage";
import WorkSamplePage from "@/app/pages/WorkSamplePage";
import TermsOfServicePage from "@/app/pages/TermsOfServicePage";
import SwornTranslationsListingPage from "@/app/pages/SwornTranslationsListingPage";
import SwornTranslationPage from "@/app/pages/SwornTranslationPage";
import ContentPage from "@/app/pages/ContentPage";
import ServicesPage from "@/app/pages/ServicesPage";
import DirectProductPage from "@/app/pages/DirectProductPage";
import ContactUsPage from "@/app/pages/ContactUsPage";
import PricingPlanPage from "@/app/pages/PricingPlanPage";
import CustomersDebugPage from "@/app/pages/CustomersDebugPage";
import ZohoPaymentDemoPage from "@/app/pages/ZohoPaymentDemoPage";
import QuickPaymentPage from "@/app/pages/QuickPaymentPage";
import TestPayNowPage from "@/app/pages/TestPayNowPage";
import DatabaseDiagnosticsPage from "@/app/pages/DatabaseDiagnosticsPage";
import EdgeFunctionHelpPage from "@/app/pages/EdgeFunctionHelpPage";

// Import components
import { SalesNotificationPopup } from "@/app/components/SalesNotificationPopup";
import SalesIQWidget from "@/app/components/SalesIQWidget";
import DemoUserInitializer from "@/app/components/DemoUserInitializer";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import ScrollToTop from "@/app/components/ScrollToTop";
import PublicLayout from "@/app/components/layout/PublicLayout";
import DatabaseSetup from "@/app/components/DatabaseSetup";
import EdgeFunctionDiagnostics from "@/app/components/EdgeFunctionDiagnostics";

function App() {
  const [appReady, setAppReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log("ðŸš€ App initialization started...");

        // Initialize storage bucket (non-blocking)
        initializeStorageBucket()
          .then(({ success }) => {
            if (success) {
              console.log("âœ… Storage bucket initialized");
            }
          })
          .catch((err) => {
            console.log(
              "â„¹ Storage bucket initialization failed (non-critical):",
              err,
            );
          });

        // Initialize demo token for mock authentication - Make this non-blocking
        initializeDemoToken()
          .then(() => {
            console.log("âœ… Demo authentication ready");
          })
          .catch(async (error) => {
            // Silently handle backend deployment issues
            if (error.message === "Backend not available") {
              // Backend not deployed - this is expected, don't spam console
              return;
            }

            // For other errors, try to create demo users
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);

              const response = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/init-demo-users`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    apikey: publicAnonKey,
                    Authorization: `Bearer ${publicAnonKey}`,
                  },
                  signal: controller.signal,
                },
              );

              clearTimeout(timeoutId);

              if (response.ok) {
                const data = await response.json();
                if (data.success) {
                  console.log("âœ… Demo users created");
                  await initializeDemoToken().catch(() => {});
                }
              }
            } catch (initError: any) {
              // Silently fail - backend not deployed
            }
          });

        // Mark app as ready immediately - don't wait for demo initialization
        console.log("âœ… App ready!");
        setAppReady(true);
      } catch (error) {
        console.error("âŒ App initialization error:", error);
        setInitError(
          error instanceof Error
            ? error.message
            : "Unknown error",
        );
        setAppReady(true); // Still render app even if init fails
      }
    };

    initializeApp();
  }, []);

  if (!appReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">
            Loading Honey Translation Services...
          </p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-4xl mb-4">âš </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Initialization Error
          </h1>
          <p className="text-gray-600 mb-4">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ScrollToTop />
        {/* <EdgeFunctionDiagnostics /> */}
        {/* <DatabaseSetup /> */}
        <DemoUserInitializer />
        <AuthProvider>
          <CurrencyProvider>
            <CartProvider>
              <WishlistProvider>
                <ProductProvider>
                  <SalesIQWidget />
                  <SalesNotificationPopup />
                  <Toaster position="top-right" richColors />
                  <Routes>
                    <Route
                      path="/admin-upload"
                      element={<AdminUpload />}
                    />
                    <Route
                      path="/signin"
                      element={<SignInPage />}
                    />
                    <Route
                      path="/login"
                      element={<SignInPage />}
                    />
                    <Route
                      path="/signup"
                      element={<SignUpPage />}
                    />
                    <Route
                      path="/auth/callback"
                      element={<AuthCallbackPage />}
                    />
                    <Route
                      path="/init-demo"
                      element={<InitDemo />}
                    />
                    <Route
                      path="/storage-setup"
                      element={<StorageSetup />}
                    />
                    <Route
                      path="/test-review"
                      element={<TestReviewPage />}
                    />
                    <Route
                      path="/debug/customers"
                      element={<CustomersDebugPage />}
                    />
                    <Route
                      path="/debug/database"
                      element={<DatabaseDiagnosticsPage />}
                    />
                    <Route
                      path="/debug/edge-function"
                      element={<EdgeFunctionHelpPage />}
                    />
                    <Route
                      path="/admin"
                      element={<AdminDashboard />}
                    />
                    <Route
                      path="/admin/items"
                      element={<ItemsPage />}
                    />
                    <Route
                      path="/admin/items/new"
                      element={<AddEditItemPage />}
                    />
                    <Route
                      path="/admin/items/edit/:id"
                      element={<AddEditItemPage />}
                    />
                    <Route
                      path="/admin/product-fields-config"
                      element={<ProductFieldsConfigPage />}
                    />
                    <Route
                      path="/admin/categories"
                      element={<CategoriesPage />}
                    />
                    <Route
                      path="/admin/coupons"
                      element={<CouponsPage />}
                    />
                    <Route
                      path="/admin/item-reviews"
                      element={<ItemReviewsPage />}
                    />
                    <Route
                      path="/admin/collections"
                      element={<ItemsPage />}
                    />
                    <Route
                      path="/admin/price-lists"
                      element={<ItemsPage />}
                    />
                    <Route
                      path="/admin/orders"
                      element={<OrdersPageAdmin />}
                    />
                    <Route
                      path="/admin/orders/:orderId"
                      element={<OrderDetailPageAdmin />}
                    />
                    <Route
                      path="/admin/customers"
                      element={<CustomersPage />}
                    />
                    <Route
                      path="/admin/accounts"
                      element={<CustomersPage />}
                    />
                    <Route
                      path="/admin/roles"
                      element={<RoleManagementPage />}
                    />
                    <Route
                      path="/admin/customer-emails"
                      element={<CustomerEmailsPage />}
                    />
                    <Route
                      path="/admin/customer-queries"
                      element={<CustomerQueriesPage />}
                    />
                    <Route
                      path="/admin/sales"
                      element={<SalesPage />}
                    />
                    <Route
                      path="/admin/sales/orders"
                      element={<OrdersPageAdmin />}
                    />
                    <Route
                      path="/admin/sales/orders/:orderId"
                      element={<OrderDetailPageAdmin />}
                    />
                    <Route
                      path="/admin/notifications"
                      element={<NotificationsPage />}
                    />
                    <Route
                      path="/admin/reports"
                      element={<ReportsPage />}
                    />
                    <Route
                      path="/admin/api-keys"
                      element={<APIKeysPage />}
                    />
                    <Route
                      path="/admin/payment-settings"
                      element={<PaymentSettingsPage />}
                    />
                    <Route
                      path="/admin/data-cleanup"
                      element={<DataCleanupPage />}
                    />
                    <Route
                      path="/admin/work-samples"
                      element={<WorkSamplesPage />}
                    />
                    <Route
                      path="/admin/work-samples/initialize"
                      element={<InitializeWorkSamplesPage />}
                    />
                    <Route
                      path="/admin/order-management-demo"
                      element={<OrderManagementDemoPage />}
                    />
                    <Route
                      path="/admin/debug/orders"
                      element={<DebugOrdersPage />}
                    />
                    <Route
                      path="/admin/orders-diagnostics"
                      element={<OrdersDiagnosticsPage />}
                    />
                    <Route
                      path="/admin/orders-setup"
                      element={<OrdersSetupPage />}
                    />
                    <Route
                      path="/admin/orders-setup/checklist"
                      element={<OrdersSetupChecklistPage />}
                    />
                    <Route
                      path="/admin/quick-orders-fix"
                      element={<QuickOrdersFixPage />}
                    />
                    <Route
                      path="/admin/diagnostics"
                      element={<DiagnosticPage />}
                    />
                    <Route
                      path="/admin/deployment-guide"
                      element={<DeploymentGuidePage />}
                    />
                    <Route
                      path="/"
                      element={
                        <PublicLayout>
                          <HomePage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/checkout-demo"
                      element={
                        <PublicLayout>
                          <CheckoutDemo />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/product/:id"
                      element={
                        <PublicLayout>
                          <ProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/track-order"
                      element={
                        <PublicLayout>
                          <TrackOrderPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/live-order-tracking/:orderId"
                      element={
                        <PublicLayout>
                          <LiveOrderTrackingPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/apostille-products"
                      element={
                        <PublicLayout>
                          <AllApostilleProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/apostille/:id"
                      element={
                        <PublicLayout>
                          <ApostillePage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/attestation-products"
                      element={
                        <PublicLayout>
                          <AllAttestationProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/apostille"
                      element={
                        <PublicLayout>
                          <AllApostilleProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/apostille/:country"
                      element={
                        <PublicLayout>
                          <ApostillePage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/attestation"
                      element={
                        <PublicLayout>
                          <AllAttestationProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/attestation/:country"
                      element={
                        <PublicLayout>
                          <ApostillePage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/startup"
                      element={
                        <PublicLayout>
                          <AllStartupProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/startup/:type"
                      element={
                        <PublicLayout>
                          <ApostillePage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/language"
                      element={
                        <PublicLayout>
                          <AllLanguageProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/startup-products"
                      element={
                        <PublicLayout>
                          <AllStartupProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/language-products"
                      element={
                        <PublicLayout>
                          <AllLanguageProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/contact"
                      element={
                        <PublicLayout>
                          <ContactPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/wishlist"
                      element={
                        <PublicLayout>
                          <WishlistPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/cart"
                      element={
                        <PublicLayout>
                          <NewCartPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/my-dashboard"
                      element={
                        <PublicLayout>
                          <MyDashboardPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/my-orders"
                      element={
                        <PublicLayout>
                          <MyOrdersPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/my-profile"
                      element={
                        <PublicLayout>
                          <MyProfilePage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/my-address"
                      element={
                        <PublicLayout>
                          <MyAddressPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/checkout/address"
                      element={
                        <PublicLayout>
                          <NewCheckoutAddressPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/checkout/review"
                      element={
                        <PublicLayout>
                          <NewCheckoutReviewPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/checkout/payment"
                      element={
                        <PublicLayout>
                          <NewPaymentPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/checkout/bank-gateway"
                      element={
                        <PublicLayout>
                          <BankGatewayPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/checkout/wallet-gateway"
                      element={
                        <PublicLayout>
                          <WalletGatewayPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/order-success"
                      element={
                        <PublicLayout>
                          <OrderSuccessPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/payment-summary"
                      element={
                        <PublicLayout>
                          <PaymentSummaryPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/translation-products"
                      element={
                        <PublicLayout>
                          <AllTranslationProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/terms-and-conditions"
                      element={
                        <PublicLayout>
                          <TermsAndConditionsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/privacy-policy"
                      element={
                        <PublicLayout>
                          <PrivacyPolicyPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/refund-cancellation-policy"
                      element={
                        <PublicLayout>
                          <RefundCancellationPolicyPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/faq"
                      element={
                        <PublicLayout>
                          <FAQPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/work-sample"
                      element={
                        <PublicLayout>
                          <WorkSamplePage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/terms-of-service"
                      element={
                        <PublicLayout>
                          <TermsOfServicePage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/pricing-plan"
                      element={
                        <PublicLayout>
                          <PricingPlanPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/contact-us"
                      element={
                        <PublicLayout>
                          <ContactUsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/blog"
                      element={
                        <PublicLayout>
                          <BlogPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/services"
                      element={
                        <PublicLayout>
                          <ServicesPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/sworn-translations-listing"
                      element={
                        <PublicLayout>
                          <SwornTranslationsListingPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/sworn-translation/:id"
                      element={
                        <PublicLayout>
                          <SwornTranslationPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/sworn-translations"
                      element={
                        <PublicLayout>
                          <SwornTranslationsListingPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/sworn-translation/:language"
                      element={
                        <PublicLayout>
                          <SwornTranslationPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/terms-conditions"
                      element={
                        <PublicLayout>
                          <TermsAndConditionsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/refund-cancellation"
                      element={
                        <PublicLayout>
                          <RefundCancellationPolicyPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/pricing"
                      element={
                        <PublicLayout>
                          <PricingPlanPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/about"
                      element={
                        <PublicLayout>
                          <ContentPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/all-translation-products"
                      element={
                        <PublicLayout>
                          <AllTranslationProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/all-apostille-products"
                      element={
                        <PublicLayout>
                          <AllApostilleProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/all-attestation-products"
                      element={
                        <PublicLayout>
                          <AllAttestationProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/all-startup-products"
                      element={
                        <PublicLayout>
                          <AllStartupProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/all-language-products"
                      element={
                        <PublicLayout>
                          <AllLanguageProductsPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/english-to-foreign-language"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/foreign-language-to-english"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/any-indian-language-to-english"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/english-to-any-indian-language"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/uae-attestation"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/china-attestation"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/qatar-attestation"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/kuwait-attestation"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/hrd-attestation-tn"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/basic-startup-package"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/standard-startup-package"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/premium-startup-package"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/content/:id"
                      element={
                        <PublicLayout>
                          <ContentPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/direct-product/:id"
                      element={
                        <PublicLayout>
                          <DirectProductPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/zoho-payment-demo"
                      element={
                        <PublicLayout>
                          <ZohoPaymentDemoPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/quick-payment"
                      element={
                        <PublicLayout>
                          <QuickPaymentPage />
                        </PublicLayout>
                      }
                    />
                    <Route
                      path="/test-pay-now"
                      element={
                        <PublicLayout>
                          <TestPayNowPage />
                        </PublicLayout>
                      }
                    />
                  </Routes>
                </ProductProvider>
              </WishlistProvider>
            </CartProvider>
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

