export function getAgeFromBirthDate(birthDate: string, now = new Date()) {
  const [year, month, day] = birthDate.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  let age = now.getFullYear() - year;
  const birthdayHasPassed =
    now.getMonth() + 1 > month ||
    (now.getMonth() + 1 === month && now.getDate() >= day);

  if (!birthdayHasPassed) {
    age -= 1;
  }

  return age;
}
