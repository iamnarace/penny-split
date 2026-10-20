import { useState } from "react";
import type { Person } from "../lib/bill";

interface Props {
  people: Person[];
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (person: Person) => void;
}

export function PeopleSection({ people, onAdd, onRename, onRemove }: Props) {
  const [name, setName] = useState("");

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Allow several names at once: "Ana, Ben, Chloe".
    trimmed
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .forEach(onAdd);
    setName("");
  }

  return (
    <section className="panel" aria-labelledby="people-heading">
      <h2 id="people-heading">Who’s at the table</h2>
      {people.length > 0 && (
        <ul className="people" aria-label="People">
          {people.map((person) => (
            <li key={person.id} className="person">
              <input
                aria-label={`Name for ${person.name || "this person"}`}
                value={person.name}
                size={Math.max(4, person.name.length + 1)}
                onChange={(e) => onRename(person.id, e.target.value)}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${person.name || "this person"}`}
                onClick={() => onRemove(person)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label htmlFor="new-person" className="visually-hidden">
          Add a person
        </label>
        <input
          id="new-person"
          value={name}
          placeholder={people.length === 0 ? "Names, separated by commas" : "Add someone"}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="button" disabled={!name.trim()}>
          Add
        </button>
      </form>
    </section>
  );
}
