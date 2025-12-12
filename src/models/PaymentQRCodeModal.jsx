import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import PaymentService from '../services/PaymentService';
import "../css/PaymentPage.css";

const PaymentQRCodeModal = ({ show, onClose, qrData }) => {
    const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 phút = 900 giây
    const [paymentStatus, setPaymentStatus] = useState(null);
    const [isChecking, setIsChecking] = useState(false); // Trạng thái đang kiểm tra

    useEffect(() => {
        if (show) {
            setTimeLeft(15 * 60); // Reset mỗi lần mở modal
            setIsChecking(false);
        }
    }, [show]);

    // Đếm ngược mỗi 1 giây
    useEffect(() => {
        if (!show) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [show]);

    useEffect(() => {
        if (!show || !qrData?.orderCode) return;

        const interval = setInterval(async () => {
            try {
                const res = await PaymentService.getPaymentStatus(qrData.orderCode);
                const status = res.status;
                setPaymentStatus(status);

                if (status === "PAID") {
                    clearInterval(interval); // Dừng polling khi thành công

                    // Gọi webhook 1 lần cuối (nếu cần)
                    await PaymentService.handleWebhook({
                        orderCode: qrData.orderCode,
                        status: "PAID"
                    });
                    window.location.href = "/main#/purchase-history"; // Chuyển hướng về trang chính
                    toast.success("Thanh toán thành công!");
                }
            } catch (err) {
                console.error("Error fetching payment status:", err);
            }
        }, 3000); // Polling mỗi 3 giây

        return () => clearInterval(interval); // Dọn dẹp
    }, [show, qrData?.orderCode, onClose]);

    const handleSafeClose = async () => {
        setIsChecking(true);
        await onClose(); // onClose sẽ kiểm tra payment status trước khi đóng
        setIsChecking(false);
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (!show || !qrData) return null;

    return (
        <div
            className="d-flex align-items-center justify-content-center"
            style={{
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
            }}
        >
            <div
                className="d-flex flex-column flex-md-row rounded overflow-hidden"
                style={{
                    width: "800px",
                    maxWidth: "95%",
                    backgroundColor: "#000",
                    borderRadius: "44px",
                }}
            >
                {/* Left - QR Code Section */}
                <div
                    className="d-flex flex-column align-items-center justify-content-center text-white p-3 p-md-4"
                    style={{
                        background: "linear-gradient(135deg, #FF0033, #B3001B)",
                        width: "100%", // full trên mobile
                        maxWidth: "100%",
                    }}
                >
                    <img
                        src={`https://img.vietqr.io/image/${qrData.bin}-${qrData.accountNumber}-compact2.png?amount=${qrData.amount}&addInfo=${encodeURIComponent(
                            qrData.description
                        )}`}
                        alt="QR"
                        className="img-fluid"
                        style={{
                            width: "250px",
                            height: "250px",
                            borderRadius: "24px",
                        }}
                    />
                    <p className="mt-3 mb-0" style={{ fontSize: "14px" }}>
                        Thời gian còn:{" "}
                        <span className="fw-bold text-warning">{formatTime(timeLeft)}</span>
                    </p>
                </div>

                {/* Right - Instruction Section */}
                <div
                    className="text-white p-3 p-md-4 position-relative"
                    style={{ backgroundColor: "#1C1C1C", width: "100%" }}
                >
                    <button
                        className="btn btn-link text-white"
                        onClick={handleSafeClose}
                        disabled={isChecking}
                        style={{
                            position: "absolute",
                            top: "12px",
                            right: "12px",
                            cursor: isChecking ? "wait" : "pointer",
                            fontSize: "20px",
                            textDecoration: "none",
                            padding: 0,
                        }}
                        title={isChecking ? "Đang kiểm tra trạng thái..." : "Đóng"}
                    >
                        {isChecking ? (
                            <i className="fas fa-spinner fa-spin"></i>
                        ) : (
                            <i className="fas fa-times"></i>
                        )}
                    </button>
                    <h6 className="fw-bold mb-4 text-center py-2 py-md-4">
                        Quét mã QR bằng ứng dụng VietQR để thanh toán dịch vụ{" "}
                        <b>Cartoon Too</b>
                    </h6>

                    {/* Steps */}
                    {[1, 2, 3].map((step) => (
                        <div
                            key={step}
                            className="d-flex align-items-start mb-3 ms-2 ms-md-4"
                            style={{ backgroundColor: '#1C1C1C' }}
                        >
                            <img
                                src={`https://fptplay.vn/images/payments/viet_qr/icon-0${step}.svg`}
                                alt={`Bước ${step}`}
                                style={{ width: 40, marginRight: 10 }}
                            />
                            <div>
                                <div className="fw-bold">Bước {step}</div>
                                <div>
                                    {step === 1
                                        ? "Mở ứng dụng ngân hàng trên điện thoại."
                                        : step === 2
                                            ? "Chọn tính năng quét mã trong ứng dụng."
                                            : "Sử dụng trình quét mã để quét mã QR."}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Warning Message */}
                    <div
                        className="alert alert-warning mt-4 mx-2 mx-md-4"
                        style={{
                            backgroundColor: '#FFC107',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px'
                        }}
                    >
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        <strong>Lưu ý:</strong> Nếu bạn đã chuyển tiền, vui lòng <strong>KHÔNG đóng cửa sổ này</strong>.
                        Hệ thống sẽ tự động xác nhận thanh toán trong vài giây.
                    </div>
                </div>
            </div>
        </div>
    );
};


export default PaymentQRCodeModal;
