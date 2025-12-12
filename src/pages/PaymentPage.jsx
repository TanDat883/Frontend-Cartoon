import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import SubscriptionPackageService from "../services/SubscriptionPackageService"; // nhớ chỉnh lại path import
import { useAuth } from "../context/AuthContext";
import PaymentQRCodeModal from "../models/PaymentQRCodeModal";
import PaymentService from "../services/PaymentService";
import { toast } from "react-toastify";
import PromotionService from "../services/PromotionService";
import axios from "axios";
import PromotionDetailService from "../services/PromotionDetailService";
import PromotionLineService from "../services/PromotionLineService";

const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { MyUser } = useAuth();
  const { selectedPackage } = location.state || {};

  const [packagesByVip, setPackagesByVip] = useState([]);
  const [selectedDurationPackage, setSelectedDurationPackage] = useState(null);

  const [qrData, setQrData] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [voucherCode, setVoucherCode] = useState("");
  const [voucherInfo, setVoucherInfo] = useState(null);

  const [promotions, setPromotions] = useState([]);

  // --- Helpers ---
  const toNumber = (x) => Number(x ?? 0);
  const formatVND = (n) => toNumber(n).toLocaleString() + " VND";
  const getEffectivePrice = (pkg) =>
    pkg?.discountedAmount != null && pkg.discountedAmount < pkg.amount
      ? pkg.discountedAmount
      : pkg?.amount ?? 0;

  useEffect(() => {
    if (!MyUser?.my_user) {
      navigate("/");
      return;
    }
  }, [MyUser, navigate]);

  useEffect(() => {
    // mỗi lần đổi gói → xoá voucher đang áp
    setVoucherCode("");
    setVoucherInfo(null);
    setQrData(null);
    setShowModal(false);
  }, [selectedDurationPackage?.packageId]);

  useEffect(() => {
    const fetchSameVipPackages = async () => {
      try {
        const data = await SubscriptionPackageService.getAllPackages();
        const normalized = data.map((p) => ({
          ...p,
          discountedAmount:
            p?.discountedAmount != null && p.discountedAmount < p.amount
              ? p.discountedAmount
              : null, // nếu = amount thì set null
        }));

        const filtered = normalized
          .filter(
            (pkg) =>
              pkg.applicablePackageType === selectedPackage.applicablePackageType
          )
          .sort(
            (a, b) => (a.durationInDays ?? 0) - (b.durationInDays ?? 0)
          );

        setPackagesByVip(filtered);
        setSelectedDurationPackage(selectedPackage);
      } catch (error) {
        console.error("Lỗi khi lấy gói theo VIP:", error);
      }
    };

    if (selectedPackage) {
      fetchSameVipPackages();
    }
  }, [selectedPackage]);

  // yyyy-MM-dd so sánh chuỗi là đủ (nếu BE trả date-only)
  const isWithinPeriod = (todayISO, start, end) => {
    if (start && todayISO < start) return false;
    if (end && todayISO > end) return false;
    return true;
  };

  // lay thong tin voucher
  const fetchVoucherInfo = async () => {
    if (!voucherCode.trim()) return null;
    try {
      const code = voucherCode.trim().toUpperCase();

      // 1) Lấy voucher info trước
      const info = await PromotionDetailService.getVoucherInfo(code);

      // 2) Lấy promotions & lines theo promotionId
      const [promos, lines] = await Promise.all([
        PromotionService.getAllPromotionsNoPagination(),
        PromotionLineService.getAllPromotionLinesByPromotionId(
          info.promotionId
        ),
      ]);
      setPromotions(promos);

      // 3) Tìm promotion + line tương ứng
      const promo = promos.find((p) => p.promotionId === info.promotionId);
      const line = lines.find((l) => l.promotionLineId === info.promotionLineId);

      // 4) Gộp dữ liệu
      const todayISO = new Date().toISOString().slice(0, 10);

      const voucherData = {
        ...info,
        promoStatus: promo?.status,
        promotionName: promo?.promotionName,
        promotionLineStatus: line?.status,
        promotionLineType: line?.promotionLineType,
        promotionLineStartDate: line?.startDate, // yyyy-MM-dd
        promotionLineEndDate: line?.endDate,
        isLineActiveNow:
          line?.status === "ACTIVE" &&
          isWithinPeriod(todayISO, line?.startDate, line?.endDate),
      };

      setVoucherInfo(voucherData);
      return voucherData;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setVoucherInfo(null);
        toast.error("Mã voucher không tồn tại hoặc đã hết hiệu lực.");
        return null;
      }
      console.error("Lỗi khi lấy thông tin voucher:", error);
      toast.error("Lỗi khi lấy thông tin voucher.");
      return null;
    }
  };

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      toast.error("Vui lòng nhập mã giảm giá.");
      return;
    }
    if (!selectedDurationPackage) return;

    const info = await fetchVoucherInfo();
    if (!info) return;

    // 1) Promotion ACTIVE
    if (info?.promoStatus !== "ACTIVE") {
      toast.error("Mã giảm giá không còn hiệu lực.");
      return;
    }

    // 2) Line phải là VOUCHER + ACTIVE + trong thời gian
    if (info?.promotionLineType !== "VOUCHER") {
      toast.error("Mã giảm giá không thuộc promotion line loại VOUCHER.");
      return;
    }
    if (info?.promotionLineStatus !== "ACTIVE") {
      toast.error("Mã giảm giá không còn hiệu lực.");
      return;
    }
    if (
      (info?.promotionLineStartDate || info?.promotionLineEndDate) &&
      !isWithinPeriod(
        new Date().toISOString().slice(0, 10),
        info?.promotionLineStartDate,
        info?.promotionLineEndDate
      )
    ) {
      toast.error("Promotion line không còn hiệu lực theo thời gian.");
      return;
    }

    // 3) Min order theo giá đang hiển thị (sau chiết khấu gói)
    const effectivePrice = getEffectivePrice(selectedDurationPackage);
    if ((info?.minOrderAmount ?? 0) > effectivePrice) {
      toast.error("Mã giảm giá không đủ điều kiện giá trị đơn hàng.");
      return;
    }

    // 4) Quota (nếu BE có trả)
    if (
      typeof info?.usedCount === "number" &&
      typeof info?.maxUsage === "number" &&
      info.usedCount >= info.maxUsage
    ) {
      toast.error("Mã giảm giá đã hết lượt sử dụng.");
      return;
    }

    // 5) Gọi BE áp dụng (BE vẫn là nơi kiểm tra cuối cùng)
    try {
      const result = await PromotionDetailService.applyVoucherCode({
        voucherCode: voucherCode.trim().toUpperCase(),
        userId: MyUser.my_user.userId,
        packageId: selectedDurationPackage.packageId,
        orderAmount: effectivePrice,
      });
      setVoucherInfo(result); // result nên có discountAmount & finalAmount
      toast.success("Áp dụng mã giảm giá thành công.");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi áp dụng mã giảm giá.");
    }
  };

  const handleCreatePayment = async () => {
    try {
      const token = localStorage.getItem("idToken"); // token bạn lưu khi login
      if (!token) {
        toast.error("Vui lòng đăng nhập trước khi thanh toán!");
        return;
      }

      // đơn hàng phải lớn hơn 0 (ưu tiên số cuối cùng nếu có voucher)
      const effectivePrice = getEffectivePrice(selectedDurationPackage);
      const final = toNumber(voucherInfo?.finalAmount ?? effectivePrice);
      if (effectivePrice <= 0 || final <= 0) {
        toast.error("Giá trị đơn hàng phải lớn hơn 0.");
        return;
      }

      const res = await PaymentService.createPayment({
        userId: MyUser.my_user.userId,
        packageId: selectedDurationPackage.packageId,
        voucherCode: voucherInfo?.voucherCode || "", // Mã giảm giá nếu có
        returnUrl: "/main#/main",
        cancelUrl: "/main#/payment",
      });
      setQrData(res);
      setShowModal(true);
    } catch (err) {
      console.error("Lỗi khi tạo thanh toán:", err?.response?.data || err?.message);
      toast.error("Lỗi khi tạo thanh toán. Vui lòng thử lại.");
    }
  };

  const handleCancelPayment = async () => {
    try {
      if (!qrData?.orderCode) {
        setShowModal(false);
        setQrData(null);
        return;
      }

      // ⚠️ Kiểm tra trạng thái thanh toán trước khi hủy
      const statusCheck = await PaymentService.getPaymentStatus(qrData.orderCode);

      if (statusCheck.status === "PAID") {
        // Nếu đã thanh toán thành công → Không cho hủy
        toast.success("Thanh toán đã thành công! Đang chuyển hướng...");
        await PaymentService.handleWebhook({
          orderCode: qrData.orderCode,
          status: "PAID"
        });
        window.location.href = "/main#/purchase-history";
        return;
      }

      // Xác nhận trước khi hủy
      const userConfirm = window.confirm(
        "Bạn có chắc chắn muốn hủy thanh toán?\n\n" +
        "⚠️ Lưu ý: Nếu bạn đã chuyển tiền, vui lòng KHÔNG hủy. " +
        "Hệ thống sẽ tự động xác nhận trong vài giây."
      );

      if (!userConfirm) return;

      // Kiểm tra lần cuối trước khi hủy
      const finalCheck = await PaymentService.getPaymentStatus(qrData.orderCode);
      if (finalCheck.status === "PAID") {
        toast.success("Thanh toán đã thành công! Đang chuyển hướng...");
        await PaymentService.handleWebhook({
          orderCode: qrData.orderCode,
          status: "PAID"
        });
        window.location.href = "/main#/purchase-history";
        return;
      }

      // Chỉ hủy nếu chưa thanh toán
      await PaymentService.cancelPayment(qrData.orderCode);
      setShowModal(false);
      setQrData(null);
      toast.info("Đã hủy giao dịch");
    } catch (err) {
      console.error("Lỗi khi hủy thanh toán:", err?.response?.data || err?.message);
      // Nếu lỗi, vẫn đóng modal nhưng không hủy payment ở backend
      setShowModal(false);
    }
  };

  // --- Derived amounts for the selected package ---
  const { basePrice, pkgDiscount, subTotalAfterPkg, voucherDiscount, finalAmount } =
    useMemo(() => {
      const base = toNumber(selectedDurationPackage?.amount);
      const d = toNumber(selectedDurationPackage?.discountedAmount);
      const pkgDisc = d > 0 && d < base ? base - d : 0;
      const subTotal = base - pkgDisc;
      const vDisc = toNumber(voucherInfo?.discountAmount);
      const final = toNumber(voucherInfo?.finalAmount ?? subTotal);
      return {
        basePrice: base,
        pkgDiscount: pkgDisc,
        subTotalAfterPkg: subTotal,
        voucherDiscount: vDisc,
        finalAmount: final,
      };
    }, [selectedDurationPackage, voucherInfo]);

  return (
    <div className="container-fluid bg-dark text-white min-vh-100 py-5">
      <div className="row justify-content-center">
        <div className="col-md-10">
          <h2 className="mb-4 mt-4">Thanh toán</h2>

          {/* Nếu chưa có selectedPackage → hiển thị thông báo trong UI (không early-return) */}
          {!selectedPackage ? (
            <div className="text-white text-center mt-5">
              Không có gói nào được chọn.
            </div>
          ) : (
            <div className="row">
              {/* Bên trái */}
              <div className="col-md-7">
                {/* Gói đã chọn */}
                <div className="card bg-black p-3 text-white mb-4">
                  <h5>Chọn thời hạn gói {selectedPackage.vipLevel}</h5>
                  <div className="card-body">
                    {packagesByVip.map((pkg) => {
                      const amount = pkg?.amount ?? 0;
                      const discounted = pkg?.discountedAmount ?? null;
                      const hasDiscount =
                        discounted != null && amount > 0 && discounted < amount;

                      return (
                        <div
                          key={pkg.packageId}
                          className={`d-flex align-items-center mb-3 rounded p-3 bg-dark ${selectedDurationPackage?.packageId === pkg.packageId
                              ? "border border-dark"
                              : ""
                            }`}
                          onClick={() => setSelectedDurationPackage(pkg)}
                          style={{ cursor: "pointer" }}
                        >
                          <input
                            type="radio"
                            className="form-check-input me-3"
                            checked={
                              selectedDurationPackage?.packageId === pkg.packageId
                            }
                            readOnly
                          />
                          <div className="d-flex justify-content-between w-100 bg-dark">
                            <span>
                              {Math.round((pkg.durationInDays ?? 30) / 30)} tháng
                            </span>
                            <div className="text-end">
                              {hasDiscount && (
                                <span className="badge rounded-pill bg-danger">
                                  Giảm {pkg.appliedDiscountPercent}%
                                </span>
                              )}
                              <span className="ms-3 fw-semibold">
                                {hasDiscount ? (
                                  <>
                                    <span className="text-warning text-decoration-line-through me-2">
                                      {amount.toLocaleString()} VND
                                    </span>
                                    <span>{discounted.toLocaleString()} VND</span>
                                  </>
                                ) : (
                                  <span>{amount.toLocaleString()} VND</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Hình thức thanh toán */}
                <div className="card bg-black p-3 text-white mb-3">
                  <h5>Chọn hình thức thanh toán</h5>
                  <div className="d-flex align-items-center bg-black p-3 rounded">
                    <input
                      type="radio"
                      className="form-check-input me-3"
                      name="paymentMethod"
                      defaultChecked
                    />
                    <img
                      src="https://images.fptplay53.net/media/photo/OTT/2024/06/24/logovietqr24-06-2024_15g35-58.png"
                      alt="vietqr"
                      width="50"
                      className="me-3"
                    />
                    <div>
                      <strong>VietQR</strong>
                      <br />
                      <small>
                        Thanh toán nhanh qua mã QR hỗ trợ hầu hết ngân hàng nội
                        địa.
                      </small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bên phải */}
              <div className="col-md-5">
                <div className="card bg-black p-3 text-white">
                  <h5>Thông tin thanh toán</h5>
                  <div className="card-body">
                    <div className="d-flex justify-content-between bg-black">
                      <p>Tài khoản</p>
                      <p className="fw-bold">{MyUser?.my_user.userName}</p>
                    </div>
                    <hr />
                    <div className="d-flex justify-content-between bg-black">
                      <p>Tên gói</p>
                      <p className="fw-bold">
                        {selectedDurationPackage?.applicablePackageType}
                      </p>
                    </div>
                    <div className="d-flex justify-content-between bg-black">
                      <p>Thời hạn</p>
                      <p className="fw-bold">
                        {selectedDurationPackage?.durationInDays / 30} tháng
                      </p>
                    </div>
                    <div className="d-flex justify-content-between bg-black">
                      <p>Gói dịch vụ</p>
                      <p className="fw-bold">Gói dịch vụ Cartoon Too</p>
                    </div>

                    <hr />

                    {/* Tính tiền chi tiết */}
                    <div className="d-flex justify-content-between bg-black">
                      <p>Giá gốc</p>
                      <p className="fw-bold">{formatVND(basePrice)}</p>
                    </div>

                    <div className="d-flex justify-content-between bg-black">
                      <p>Giảm theo gói (chiết khấu)</p>
                      <p className="fw-bold">{formatVND(pkgDiscount)}</p>
                    </div>

                    {/* <div className="d-flex justify-content-between bg-black">
                      <p>Tạm tính sau chiết khấu</p>
                      <p className="fw-bold">{formatVND(subTotalAfterPkg)}</p>
                    </div> */}

                    <div className="d-flex justify-content-between bg-black">
                      <p>Giảm mã voucher</p>
                      <p className="fw-bold">{formatVND(voucherDiscount)}</p>
                    </div>

                    <hr />

                    <div className="d-flex justify-content-between bg-black">
                      <p className="mb-0">Tổng thanh toán</p>
                      <h3 className="fw-bold text-warning mb-0">
                        {formatVND(finalAmount)}
                      </h3>
                    </div>

                    <div className="text-end mt-2">
                      <small className="text-success">
                        Đã tiết kiệm {formatVND(pkgDiscount + voucherDiscount)}
                      </small>
                    </div>

                    {/* Nhập voucher */}
                    <div className="d-flex bg-black w-100 mt-3">
                      <div className="col-8">
                        <input
                          type="text"
                          className="form-control bg-secondary"
                          value={voucherCode}
                          onChange={(e) => {
                            setVoucherCode(e.target.value.toUpperCase());
                            setVoucherInfo(null);
                          }}
                          placeholder="Nhập mã giảm giá"
                        />
                      </div>
                      <div className="col-4 ms-2">
                        <button
                          type="button"
                          className="btn btn-secondary w-100"
                          onClick={handleApplyVoucher}
                        >
                          Áp dụng
                        </button>
                      </div>
                    </div>

                    <div className="text-center mt-3">
                      <button
                        className="btn btn-watch w-100 mt-3 text-black fw-bold"
                        onClick={handleCreatePayment}
                      >
                        Thanh toán
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* end right */}
            </div>
          )}
        </div>

        <PaymentQRCodeModal
          show={showModal}
          onClose={handleCancelPayment}
          qrData={qrData}
        />
      </div>
    </div>
  );
};

export default PaymentPage;
