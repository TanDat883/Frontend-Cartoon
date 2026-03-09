import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthService from "../services/AuthService";
import { formatPhoneNumber } from "../utils/formatPhoneNumber";
import showToast from "../utils/AppUtils";
import Logo from "../components/Logo";
import "../css/RegisterPage.css";

const RegisterPage = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSoundOn, setIsSoundOn] = useState(false);

  const validatePassword = (pass) =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(pass);

  const getAge = (dobString) => {
    const d = new Date(dobString);
    const t = new Date();
    let age = t.getFullYear() - d.getFullYear();
    if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age--;
    return age;
  };

  const handleSendOtp = async () => {
    setErrorMessage("");
    setIsLoading(true);

    try {
      if (!name || !dob || !phoneNumber || !password || !confirmPassword) {
        throw new Error("Vui lòng nhập đầy đủ Họ tên, Ngày sinh, SĐT và Mật khẩu.");
      }
      if (getAge(dob) < 14) {
        throw new Error("Bạn phải đủ **14 tuổi** để đăng ký.");
      }
      const formattedPhone = formatPhoneNumber(phoneNumber);
      if (!formattedPhone) throw new Error("Số điện thoại không đúng định dạng.");

      if (!validatePassword(password)) {
        throw new Error("Mật khẩu ≥ 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.");
      }
      if (password !== confirmPassword) throw new Error("Xác nhận mật khẩu không khớp.");

      // Lưu lại phone đã format để dùng bước OTP
      setPhoneNumber(formattedPhone);

      await AuthService.post("/send-otp", { phoneNumber: formattedPhone, password });
      setIsOtpSent(true);
      showToast("OTP đã gửi, vui lòng kiểm tra tin nhắn!", "success");
    } catch (e) {
      setErrorMessage(e.response?.data || e.message || "Lỗi khi gửi OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMessage("");
    setIsLoading(true);
    try {
      if (!verificationCode) throw new Error("Vui lòng nhập OTP.");

      const user = {
        userId: Date.now().toString(),
        userName: name,
        dob,
        phoneNumber,
      };
      await AuthService.post("/verify-phone-and-create-user", {
        phoneNumber,
        verificationCode,
        user,
      });

      showToast("Tạo tài khoản thành công. Bạn có thể đăng nhập ngay!", "success");
      navigate("/");
    } catch (e) {
      setErrorMessage(e.response?.data || "Mã OTP không đúng hoặc đã hết hạn.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-bg-video">
      {/* BG video giống LoginPage */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted={!isSoundOn}
        preload="auto"
        playsInline
        className="bg-video"
      >
        <source src={`${process.env.PUBLIC_URL}/videologin.mp4`} type="video/mp4" />
      </video>

      {/* Nút âm lượng */}
      <div className="sound-toggle">
        <button
          onClick={() => {
            const next = !isSoundOn;
            setIsSoundOn(next);
            if (videoRef.current) {
              videoRef.current.muted = !next;
              if (next) videoRef.current.play();
            }
          }}
        >
          {isSoundOn ? "🔊" : "🔈"}
        </button>
      </div>

      {/* Topbar: logo + xem ngay */}
      <div className="auth-topbar">
        <Link to="/main" className="brand">
          <Logo type="wordmark" size={40} />
        </Link>
        <button className="btn-watch" style={{ width: "10%" }} onClick={() => navigate("/main")}>
          ▶ Xem ngay
        </button>
      </div>

      {/* Content */}
      <div className="login-content">
        <div className="card auth-card p-4">
          <div className="text-center mb-3">
            <h1 className="auth-heading">Tạo tài khoản</h1>
            <p className="auth-subtitle">
              Đăng ký để lưu phim yêu thích và đồng bộ trên mọi thiết bị.
            </p>
          </div>

          {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}

          {!isOtpSent ? (
            <>
              <div className="row g-2">
                <div className="col-12 col-sm-7">
                  <input
                    className="form-control"
                    type="text"
                    placeholder="📝 Họ và tên"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="col-12 col-sm-5">
                  <input
                    className="form-control"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-2">
                <input
                  className="form-control"
                  type="text"
                  placeholder="📱 Số điện thoại"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              <div className="mt-2">
                <input
                  className="form-control"
                  type="password"
                  placeholder="🔒 Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="mt-2">
                <input
                  className="form-control"
                  type="password"
                  placeholder="🔑 Xác nhận mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                className="btn-login-dark w-100 mt-3"
                onClick={handleSendOtp}
                disabled={isLoading}
              >
                {isLoading ? "Đang gửi OTP..." : "Gửi OTP & Đăng ký"}
              </button>
            </>
          ) : (
            <>
              <div className="mt-2">
                <input
                  className="form-control"
                  type="text"
                  placeholder="🔢 Nhập mã OTP (Mã demo 123456)"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>
              <button
                className="btn-login-dark w-100 mt-3"
                onClick={handleVerifyOtp}
                disabled={isLoading}
              >
                {isLoading ? "Đang xác minh..." : "Xác minh & Hoàn tất"}
              </button>
            </>
          )}

          <hr className="auth-sep mt-4" />
          <div className="text-center">
            <span className="muted">Đã có tài khoản? </span>
            <Link to="/" className="text-link fw-bold">
              Đăng nhập
            </Link>
          </div>

          <div className="auth-footer mt-3">© Bản quyền thuộc về Cartoon Too.</div>
        </div>

        {isLoading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p className="loading-text">Đang xử lý...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;
