export default function Avatar({ user, size = 'md' }) {
  const name = user && user.name ? user.name : '?';
  const has = user && user.image && !/notfound\.png$/.test(user.image);
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {has ? <img src={user.image} alt="" /> : name.charAt(0).toUpperCase()}
    </span>
  );
}
