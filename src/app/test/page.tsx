"use client";

export default function TestPage() {
  return (
    <div style={{ padding: 40 }}>
      <h1>Test Page</h1>
      <button
        onClick={() => alert("it works!")}
        style={{ padding: 20, fontSize: 18, background: "black", color: "white", border: "none", borderRadius: 12 }}
      >
        Click me
      </button>
      <br /><br />
      <a href="/" style={{ fontSize: 18 }}>Go home</a>
    </div>
  );
}
