import { useCallback, useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import SubscriptionPackageService from "../../services/SubscriptionPackageService";
import CreateSubscriptionPackageModal from "../../models/CreateSubscriptionPackageModal";
import "../../css/admin/SubscriptionPackageManagementPage.css";

const SubscriptionPackageManagementPage = () => {
    const [subscriptionPackages, setSubscriptionPackages] = useState([]);
    const [page, setPage] = useState(1);
    const [size] = useState(4);
    const [total, setTotal] = useState(0);
    const [keyword, setKeyword] = useState("");
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [editingPkg, setEditingPkg] = useState(null);
    const [activeSubscriptions, setActiveSubscriptions] = useState({}); // Track packages with active subscriptions

    // Load dữ liệu
    const loadSubscriptionPackages = async () => {
        try {
            const data = await SubscriptionPackageService.getAll(page, size, keyword);
            setSubscriptionPackages(data.items);
            setTotal(data.total);

            // Check for active subscriptions for each package
            const subscriptionChecks = {};
            for (const pkg of data.items) {
                const result = await SubscriptionPackageService.checkActiveSubscriptions(pkg.packageId);
                subscriptionChecks[pkg.packageId] = result.hasActiveSubscriptions || false;
            }
            setActiveSubscriptions(subscriptionChecks);
        } catch (err) {
            console.error("Lỗi load gói đăng ký:", err);
        }
    };

    // Gọi khi page hoặc keyword thay đổi
    useEffect(() => {
        loadSubscriptionPackages();
    }, [page, keyword]);

    // Tổng số trang
    const totalPages = Math.ceil(total / size);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1); // reset về trang 1 khi search
        loadSubscriptionPackages();
    };

    const handleCreateModalOpen = () => {
        setEditingPkg(null);
        setCreateModalOpen(true);
    };

    const handleEditModalOpen = (pkg) => {
        setEditingPkg(pkg);
        setCreateModalOpen(true);
    };

    const handleDelete = async (packageId) => {
        // Double check before deletion
        if (activeSubscriptions[packageId]) {
            alert("Không thể xóa gói đang có người dùng đăng ký ACTIVE!");
            return;
        }

        if (window.confirm("Bạn có chắc chắn muốn xóa gói đăng ký này?")) {
            try {
                await SubscriptionPackageService.deletePackage(packageId);
                setSubscriptionPackages((prev) => prev.filter((p) => p.packageId !== packageId));
                // Remove from activeSubscriptions tracking
                setActiveSubscriptions((prev) => {
                    const updated = { ...prev };
                    delete updated[packageId];
                    return updated;
                });
            } catch (err) {
                console.error("Lỗi xóa gói đăng ký:", err);
                alert(err.message || "Có lỗi xảy ra khi xóa gói đăng ký");
            }
        }
    };

    return (
        <div className="admin-shell">
            <Sidebar />
            <div className="admin-main">
                <h2 className="mb-4 fw-bold">QUẢN LÝ GÓI</h2>
                <div className="card">
                    {/* Card header with search and add button */}
                    <div className="card-header">
                        <div
                            className="d-flex justify-content-between align-items-center"
                            style={{ flexWrap: "wrap" }}
                        >
                            <div style={{ maxWidth: "400px", width: "100%" }}>
                                <form role="search" onSubmit={handleSearch}>
                                    <div className="input-group">
                                        <input
                                            type="search"
                                            className="form-control rounded-start"
                                            placeholder="Tìm kiếm gói đăng ký"
                                            name="keyword"
                                            value={keyword}
                                            onChange={(e) => setKeyword(e.target.value)}
                                        />
                                        <span type="submit" className="btn btn-outline-secondary rounded-end">
                                            <i className="fa fa-search"></i>
                                        </span>
                                    </div>
                                </form>
                            </div>
                            <div className="mt-2 mt-md-0">
                                <button type="button" className="btn btn-primary  px-5" onClick={handleCreateModalOpen}>
                                    <i className="fa fa-plus me-2"></i>
                                    Tạo gói đăng ký
                                </button>
                            </div>
                        </div>
                    </div>
                    { /* Card body with movie list table */}
                    <div className="card-body">
                        <div className="admin-table-responsive">
                            <table className="table table-striped table-bordered table-hover align-middle pkg-table">
                                <thead className="table-light">
                                    <tr>
                                        <th className="pkg-id">ID</th>
                                        <th className="pkg-name">Tên gói đăng ký</th>
                                        <th className="pkg-type">Loại gói</th>
                                        <th className="pkg-duration">Thời gian</th>
                                        <th className="pkg-features">Đặc điểm</th>
                                        <th className="pkg-actions">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subscriptionPackages.map((pkg) => (
                                        <tr key={pkg.packageId}>
                                            <td className="pkg-id">{pkg.packageId}</td>
                                            <td className="pkg-name">{pkg.packageName}</td>
                                            <td className="pkg-type">{pkg.applicablePackageType}</td>
                                            <td className="pkg-duration">{pkg.durationInDays} ngày</td>
                                            <td className="pkg-features">{(pkg.features || []).join(", ")}</td>
                                            <td className="pkg-actions" style={{ minWidth: 200 }}>
                                                <span
                                                    className="btn btn-sm btn-outline-primary"
                                                    style={{ borderRadius: 10, padding: "5px 10px", fontSize: 14 }}
                                                    onClick={() => handleEditModalOpen(pkg)}
                                                >
                                                    <i className="fa-solid fa-pen-to-square"></i> Chỉnh sửa
                                                </span>
                                                {(() => {
                                                    const hasActiveSubscriptions = activeSubscriptions[pkg.packageId];
                                                    const hasPriceList = pkg.currentPriceListId;
                                                    const isDisabled = hasActiveSubscriptions || hasPriceList;

                                                    let tooltipMessage = 'Xóa gói đăng ký';
                                                    if (hasActiveSubscriptions && hasPriceList) {
                                                        tooltipMessage = 'Không thể xóa: Gói đang có người dùng ACTIVE và thuộc bảng giá';
                                                    } else if (hasActiveSubscriptions) {
                                                        tooltipMessage = 'Không thể xóa: Gói đang có người dùng đăng ký ACTIVE';
                                                    } else if (hasPriceList) {
                                                        tooltipMessage = 'Không thể xóa: Gói đang thuộc bảng giá';
                                                    }

                                                    return (
                                                        <span
                                                            className={`btn btn-sm btn-outline-danger ms-2 ${isDisabled ? 'disabled' : ''}`}
                                                            style={{
                                                                borderRadius: 10,
                                                                padding: "5px 10px",
                                                                fontSize: 14,
                                                                opacity: isDisabled ? 0.5 : 1,
                                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                                pointerEvents: isDisabled ? 'none' : 'auto'
                                                            }}
                                                            onClick={() => !isDisabled && handleDelete(pkg.packageId)}
                                                            title={tooltipMessage}
                                                        >
                                                            <i className="fa-solid fa-trash"></i> Xóa
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <nav>
                                <ul className="pagination justify-content-center">
                                    <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                                        <button
                                            className="page-link"
                                            onClick={() => setPage(page - 1)}
                                        >
                                            {"<"}
                                        </button>
                                    </li>

                                    {[...Array(totalPages).keys()].map((i) => (
                                        <li
                                            key={i}
                                            className={`page-item ${page === i + 1 ? "active" : ""}`}
                                        >
                                            <button
                                                className="page-link"
                                                onClick={() => setPage(i + 1)}
                                            >
                                                {i + 1}
                                            </button>
                                        </li>
                                    ))}

                                    <li
                                        className={`page-item ${page === totalPages ? "disabled" : ""
                                            }`}
                                    >
                                        <button
                                            className="page-link"
                                            onClick={() => setPage(page + 1)}
                                        >
                                            {">"}
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                        )}
                    </div>
                </div>
                <CreateSubscriptionPackageModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setCreateModalOpen(false)}
                    onCreated={loadSubscriptionPackages}
                    initialData={editingPkg}
                    existingIds={subscriptionPackages.map(p => p.packageId)}
                />
            </div>
        </div>
    );
};
export default SubscriptionPackageManagementPage;