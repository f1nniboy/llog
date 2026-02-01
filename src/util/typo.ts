/* A string of characters for each row of the keyboard */
const rows: string[] = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]

export class Typo {
    public static adjacentKeys(rows: string[]): Record<string, string[]> {
        let map: Record<string, string[]> = {}

        for (let r = 0; r < rows.length; r++) {
            let row = rows[r]
            for (let i = 0; i < row.length; i++) {
                let char = row[i]
                let adjacent = []

                // Add the previous character if it exists
                if (i > 0) adjacent.push(row[i - 1])

                // Add the next character if it exists
                if (i < row.length - 1) adjacent.push(row[i + 1])

                // Add the character above if it exists
                if (r > 0 && i < rows[r - 1].length)
                    adjacent.push(rows[r - 1][i])

                // Add the character below if it exists
                if (r < rows.length - 1 && i < rows[r + 1].length)
                    adjacent.push(rows[r + 1][i])

                // Add the array to the map with the character as the key
                map[char] = adjacent
            }
        }

        return map
    }

    public static add(str: string): string {
        // Generate the map of adjacent keys
        let adjacentKeys = Typo.adjacentKeys(rows)

        // Check if the string is empty or not
        if (str.length == 0) return str
        else {
            let index = Math.floor(Math.random() * str.length)
            let char = str[index]

            // Get the array of adjacent keys for that character
            let adjKeys = adjacentKeys[char.toLowerCase()]

            // If there are no adjacent keys, return the original string
            if (!adjKeys) return str
            else {
                // Choose a random adjacent key and insert it at the index
                let newChar =
                    adjKeys[Math.floor(Math.random() * adjKeys.length)]
                return str.slice(0, index) + newChar + str.slice(index)
            }
        }
    }
}
