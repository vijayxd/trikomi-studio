import React, { useState } from "react";

interface StudioCardProps {
  title: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  defaultCollapsed?: boolean;
  flex?: number | string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const StudioCard: React.FC<StudioCardProps> = ({
  title,
  icon,
  headerRight,
  defaultCollapsed = false,
  flex,
  children,
  className = "",
  style = {}
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);

  return (
    <div
      className={`studio-subcard ${collapsed ? "subcard-collapsed" : ""} ${className}`}
      style={{
        flex: collapsed ? "0 0 auto" : (flex !== undefined ? flex : 1),
        transition: "all 0.22s ease-out",
        ...style
      }}
    >
      <div
        className="subcard-title-bar"
        onClick={() => setCollapsed(!collapsed)}
        style={{ cursor: "pointer", userSelect: "none" }}
        title={collapsed ? `Expand ${title}` : `Collapse ${title}`}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "8.5px", color: "var(--neon-cyan)", transition: "transform 0.2s" }}>
            {collapsed ? "▸" : "▾"}
          </span>
          {icon}
          <span style={{ fontSize: "10.5px" }}>{title}</span>
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
          onClick={(e) => e.stopPropagation()}
        >
          {headerRight}
        </div>
      </div>
      {!collapsed && (
        <div className="subcard-content-wrapper" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {children}
        </div>
      )}
    </div>
  );
};
